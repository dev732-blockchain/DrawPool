// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// MAINNET PRODUCTION — MAX_ENTRIES=200, PRIZE=$100

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract DrawPool is VRFConsumerBaseV2Plus, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant TICKET_PRICE = 1_000_000;       // $1 USDT (6 decimals)
    uint256 public constant MAX_ENTRIES = 200;               // 200 entries per round
    uint256 public constant PRIZE_AMOUNT = 100_000_000;      // $100 USDT prize

    // State Variables
    uint256 public currentRoundId;
    uint256 public totalRoundsCompleted;
    bool public isDestroyed;
    
    IERC20 public usdtToken;
    uint256 public vrfSubscriptionId;
    bytes32 public vrfKeyHash;
    
    uint256 public refundIndex;

    struct Round {
        uint256 id;
        address[] entries;
        address winner;
        uint256 winnerIndex;
        bool isComplete;
        bool isLocked;
        uint256 startedAt;
        uint256 completedAt;
        uint256 vrfRequestId;
    }

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => uint256) public vrfRequestToRound;
    mapping(uint256 => mapping(address => uint256)) public entriesPerUser;

    // Events
    event EntryPurchased(uint256 indexed roundId, address indexed buyer, uint256 quantity);
    event DrawRequested(uint256 indexed roundId, uint256 indexed requestId);
    event WinnerSelected(uint256 indexed roundId, address indexed winner, uint256 winnerIndex);
    event PrizePaid(uint256 indexed roundId, address indexed winner, uint256 amount);
    event RoundStarted(uint256 indexed roundId);
    event EntryRefunded(uint256 indexed roundId, address indexed user, uint256 amount);
    event ContractDestroyed();

    modifier notDestroyed() {
        require(!isDestroyed, "Contract is deactivated");
        _;
    }

    constructor(
        address _usdt,
        address _vrf,
        uint256 _subId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2Plus(_vrf) {
        usdtToken = IERC20(_usdt);
        vrfSubscriptionId = _subId;
        vrfKeyHash = _keyHash;

        currentRoundId = 1;
        rounds[1].id = 1;
        rounds[1].startedAt = block.timestamp;

        emit RoundStarted(1);
    }

    /**
     * @notice Allows users to buy multiple entries into the active prize draw round.
     * @param quantity The number of ticket entries to buy (1-100).
     */
    function enterDraw(uint256 quantity) public nonReentrant notDestroyed whenNotPaused {
        require(quantity >= 1 && quantity <= 100, "Quantity must be between 1 and 100");
        
        Round storage round = rounds[currentRoundId];
        require(!round.isLocked, "Current round is locked for drawing");
        require(quantity <= MAX_ENTRIES - round.entries.length, "Not enough remaining entries in this round");

        // Pull USDT from user
        usdtToken.safeTransferFrom(msg.sender, address(this), quantity * TICKET_PRICE);

        // Record entries
        for (uint256 i = 0; i < quantity; i++) {
            round.entries.push(msg.sender);
        }
        
        entriesPerUser[currentRoundId][msg.sender] += quantity;

        emit EntryPurchased(currentRoundId, msg.sender, quantity);

        // Trigger draw if round is full
        if (round.entries.length == MAX_ENTRIES) {
            _requestDraw();
        }
    }

    /**
     * @notice Locks the round and requests random words from Chainlink VRF.
     */
    function _requestDraw() internal {
        Round storage round = rounds[currentRoundId];
        round.isLocked = true;

        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: vrfKeyHash,
                subId: vrfSubscriptionId,
                requestConfirmations: 3,
                callbackGasLimit: 400000,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: false })
                )
            })
        );

        round.vrfRequestId = requestId;
        vrfRequestToRound[requestId] = currentRoundId;

        emit DrawRequested(currentRoundId, requestId);
    }

    /**
     * @notice Chainlink VRF Callback function that selects the winner and distributes payouts.
     */
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 roundId = vrfRequestToRound[requestId];
        Round storage round = rounds[roundId];

        require(round.isLocked, "Round is not locked");
        require(!round.isComplete, "Round is already complete");

        uint256 winnerIndex = randomWords[0] % round.entries.length;
        address winner = round.entries[winnerIndex];

        round.winner = winner;
        round.winnerIndex = winnerIndex;
        round.isComplete = true;
        round.completedAt = block.timestamp;

        emit WinnerSelected(roundId, winner, winnerIndex);

        // 1. Pay the winner the prize amount
        usdtToken.safeTransfer(winner, PRIZE_AMOUNT);
        emit PrizePaid(roundId, winner, PRIZE_AMOUNT);

        // 2. Transfer the remaining balance to the contract owner
        uint256 contractBalance = usdtToken.balanceOf(address(this));
        if (contractBalance > 0) {
            usdtToken.safeTransfer(owner(), contractBalance);
        }

        totalRoundsCompleted++;

        // 3. Initialize next round automatically
        if (!isDestroyed) {
            currentRoundId = roundId + 1;
            rounds[currentRoundId].id = currentRoundId;
            rounds[currentRoundId].startedAt = block.timestamp;
            refundIndex = 0; // Reset refund index for next round
            
            emit RoundStarted(currentRoundId);
        }
    }

    /**
     * @notice Emergency batch refund tool for active round participants.
     * @param batchSize The number of entries to process in this transaction.
     */
    function emergencyRefund(uint256 batchSize) public onlyOwner notDestroyed {
        Round storage round = rounds[currentRoundId];
        uint256 len = round.entries.length;
        uint256 start = refundIndex;
        uint256 end = start + batchSize;
        
        if (end > len) {
            end = len;
        }

        for (uint256 i = start; i < end; i++) {
            address user = round.entries[i];
            usdtToken.safeTransfer(user, TICKET_PRICE);
            emit EntryRefunded(currentRoundId, user, TICKET_PRICE);
        }

        refundIndex = end;
    }

    /**
     * @notice Stop platform and refund remaining users (emergency deactivation).
     */
    function killSwitch() public onlyOwner notDestroyed {
        Round storage round = rounds[currentRoundId];
        uint256 len = round.entries.length;
        
        // Refund remaining entries starting from current refund index
        for (uint256 i = refundIndex; i < len; i++) {
            address user = round.entries[i];
            usdtToken.safeTransfer(user, TICKET_PRICE);
            emit EntryRefunded(currentRoundId, user, TICKET_PRICE);
        }

        isDestroyed = true;
        
        // Sweep remaining token balances to owner
        uint256 remainingUSDT = usdtToken.balanceOf(address(this));
        if (remainingUSDT > 0) {
            usdtToken.safeTransfer(owner(), remainingUSDT);
        }

        emit ContractDestroyed();

        // selfdestruct deprecated but compiles in 0.8.19
        selfdestruct(payable(owner()));
    }

    // Owner controls to pause and unpause draw entries
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // View functions
    function getActiveRound() external view returns (uint256 roundId, uint256 entriesSold, bool isLocked, bool deactivated) {
        Round storage round = rounds[currentRoundId];
        return (currentRoundId, round.entries.length, round.isLocked, isDestroyed);
    }

    function getUserEntries(address user, uint256 roundId) external view returns (uint256) {
        return entriesPerUser[roundId][user];
    }

    function getRound(uint256 roundId) external view returns (
        uint256 id,
        address winner,
        uint256 winnerIndex,
        bool isComplete,
        bool isLocked,
        uint256 startedAt,
        uint256 completedAt,
        uint256 vrfRequestId
    ) {
        Round storage round = rounds[roundId];
        return (
            round.id,
            round.winner,
            round.winnerIndex,
            round.isComplete,
            round.isLocked,
            round.startedAt,
            round.completedAt,
            round.vrfRequestId
        );
    }

    function getRoundEntrants(uint256 roundId) external view returns (address[] memory) {
        return rounds[roundId].entries;
    }
}
