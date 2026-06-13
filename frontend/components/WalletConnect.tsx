'use client';

import { useState, useEffect } from 'react';

interface WalletConnectProps {
  onAddressChange?: (address: string | null) => void;
}

export default function WalletConnect({ onAddressChange }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Helper to resolve the correct injected provider, avoiding conflicts (e.g. Coinbase Wallet vs MetaMask)
  const getEthereumProvider = () => {
    if (typeof window === 'undefined') return null;
    let provider = (window as any).ethereum;
    if (provider && provider.providers) {
      provider = provider.providers.find((p: any) => p.isMetaMask) || provider;
    }
    return provider;
  };

  // Check if wallet is already connected on load
  useEffect(() => {
    const checkConnection = async () => {
      const provider = getEthereumProvider();
      if (provider) {
        try {
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            handleNewAccounts(accounts);
          }
          const cid = await provider.request({ method: 'eth_chainId' });
          setChainId(cid);
        } catch (err) {
          console.error('[WalletConnect] Error checking accounts/network:', err);
        }
      }
    };

    checkConnection();

    // Check again after a short delay to account for lazy loading of the extension provider
    const timer = setTimeout(checkConnection, 1000);

    // Listen to account and chain changes
    const provider = getEthereumProvider();
    if (provider) {
      if (provider.on) {
        provider.on('accountsChanged', handleNewAccounts);
        provider.on('chainChanged', () => window.location.reload());
      }
    }

    return () => {
      clearTimeout(timer);
      const provider = getEthereumProvider();
      if (provider && provider.removeListener) {
        provider.removeListener('accountsChanged', handleNewAccounts);
      }
    };
  }, []);

  const handleNewAccounts = (accounts: string[]) => {
    if (accounts.length > 0) {
      const addr = accounts[0].toLowerCase();
      setAddress(addr);
      setError(null);
      if (onAddressChange) onAddressChange(addr);
    } else {
      setAddress(null);
      if (onAddressChange) onAddressChange(null);
    }
  };

  const connectWallet = async () => {
    if (isConnecting) return;
    setError(null);
    if (typeof window === 'undefined') return;

    // Check if user is on mobile and using insecure HTTP local IP
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && window.location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setError('MetaMask Mobile requires a secure HTTPS connection to connect to local servers. Please run a secure tunnel (e.g. ngrok) and visit the HTTPS URL.');
      return;
    }

    const provider = getEthereumProvider();
    if (!provider) {
      const isMetaMaskMobile = /MetaMask/i.test(navigator.userAgent);
      
      if (isMobile && !isMetaMaskMobile) {
        const cleanUrl = window.location.href.replace(/^https?:\/\//, '');
        window.location.href = `https://metamask.app.link/dapp/${cleanUrl}`;
        return;
      }
      
      if (isMetaMaskMobile) {
        setError('Web3 provider is not injected. MetaMask Mobile blocks Web3 on HTTP IP connections. If testing locally, please use HTTPS (e.g., via an ngrok tunnel).');
        return;
      }
      
      setError('MetaMask is not installed. Please install it to enter the draw.');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });
      handleNewAccounts(accounts);
      
      const cid = await provider.request({ method: 'eth_chainId' });
      setChainId(cid);

      // Prompt to switch to Polygon/Amoy network if needed
      await verifyNetwork();
    } catch (err: any) {
      console.error('[WalletConnect] Connection error:', err);
      if (err.code === -32002) {
        setError('A connection request is already pending in MetaMask. Please click the MetaMask extension icon in your browser toolbar to approve the connection.');
      } else if (err.code === 4001) {
        setError('Connection request rejected. Please approve the request to connect.');
      } else {
        setError(err.message || 'Failed to connect wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const verifyNetwork = async () => {
    const provider = getEthereumProvider();
    if (!provider) return;
    
    // Correct hex for Amoy is 0x13882 (80002 decimal)
    const targetChainIdHex = process.env.NEXT_PUBLIC_IS_TESTNET === 'true' 
      ? '0x13882' // Correct chain ID 80002 for Amoy
      : '0x89';    // 137 for Polygon Mainnet

    try {
      const currentChainId = await provider.request({ method: 'eth_chainId' });
      setChainId(currentChainId);
      
      if (currentChainId.toLowerCase() !== targetChainIdHex.toLowerCase()) {
        // If isTestnet is true, do NOT automatically switch/add network.
        if (process.env.NEXT_PUBLIC_IS_TESTNET === 'true') {
          console.log('[WalletConnect] Testnet configured. Skipping automatic switch request per user preference.');
          return;
        }

        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetChainIdHex }],
          });
        } catch (switchError: any) {
          // If the network does not exist in MetaMask, prompt to add it
          if (switchError.code === 4902) {
            const addParams = {
              chainId: '0x89',
              chainName: 'Polygon Mainnet',
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com'],
              blockExplorerUrls: ['https://polygonscan.com'],
            };

            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [addParams],
            });
          } else {
            throw switchError;
          }
        }
      }
    } catch (err: any) {
      console.error('[WalletConnect] Network verification failed:', err.message || err.code || err);
    }
  };

  const handleAddPolygon = async () => {
    const provider = getEthereumProvider();
    if (typeof window === 'undefined' || !provider) return;
    
    const targetChainIdHex = process.env.NEXT_PUBLIC_IS_TESTNET === 'true'
      ? '0x13882'
      : '0x89';

    const addParams = process.env.NEXT_PUBLIC_IS_TESTNET === 'true'
      ? {
          chainId: '0x13882',
          chainName: 'Polygon Amoy Testnet',
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          rpcUrls: ['https://rpc-amoy.polygon.technology'],
          blockExplorerUrls: ['https://amoy.polygonscan.com'],
        }
      : {
          chainId: '0x89',
          chainName: 'Polygon Mainnet',
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          rpcUrls: ['https://polygon-rpc.com'],
          blockExplorerUrls: ['https://polygonscan.com'],
        };

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainIdHex }],
      });
      const cid = await provider.request({ method: 'eth_chainId' });
      setChainId(cid);
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [addParams],
          });
          const cid = await provider.request({ method: 'eth_chainId' });
          setChainId(cid);
        } catch (addError: any) {
          console.error('[WalletConnect] Failed to add network:', addError);
          setError(addError.message || 'Failed to add network');
        }
      } else {
        console.error('[WalletConnect] Failed to switch network:', switchError);
        setError(switchError.message || 'Failed to switch network');
      }
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    if (onAddressChange) onAddressChange(null);
  };

  const shortenAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const targetChainIdHex = process.env.NEXT_PUBLIC_IS_TESTNET === 'true' 
    ? '0x13882'
    : '0x89';
  const showAddPolygon = address && chainId && chainId.toLowerCase() !== targetChainIdHex.toLowerCase();

  return (
    <div className="flex flex-col items-center">
      {address ? (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <span className="text-sm font-mono bg-[#16213E] border border-[#2c3a5f] px-3 py-1.5 rounded-lg text-[#E2E8F0]">
            {shortenAddress(address)}
          </span>
          {showAddPolygon && (
            <button
              onClick={handleAddPolygon}
              className="bg-[#E6A817] hover:bg-[#ffd043] text-[#1A1A2E] font-semibold px-3 py-1.5 rounded-lg text-xs shadow-md transition-all duration-200 cursor-pointer"
            >
              Add Polygon
            </button>
          )}
          <button
            onClick={disconnectWallet}
            className="text-xs text-[#8E9BB0] hover:text-[#ef4444] transition-colors cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className={`bg-[#E6A817] hover:bg-[#ffd043] disabled:opacity-50 disabled:cursor-not-allowed text-[#1A1A2E] font-semibold px-4 py-2 rounded-lg shadow-md transition-all duration-200 cursor-pointer ${
            isConnecting ? 'opacity-75' : ''
          }`}
        >
          {isConnecting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin text-xs">⏳</span>
              Connecting...
            </span>
          ) : (
            'Connect Wallet'
          )}
        </button>
      )}
      {error && <p className="text-xs text-[#ef4444] mt-2 font-medium text-center">{error}</p>}
    </div>
  );
}
