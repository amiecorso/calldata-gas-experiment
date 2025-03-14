import { type Abi } from "viem";
export const PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS = "0x948ca2f66C61a026b4B396EFCE887db811c6e35A";

export const PaymentEscrowCalldataOptimizedAbi =  [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "_erc6492Validator",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    { "type": "receive", "stateMutability": "payable" },
    {
      "type": "function",
      "name": "ERC6492_MAGIC_VALUE",
      "inputs": [],
      "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "authorize",
      "inputs": [
        { "name": "salt", "type": "uint256", "internalType": "uint256" },
        {
          "name": "details",
          "type": "tuple",
          "internalType": "struct PaymentEscrow.PaymentDetails",
          "components": [
            {
              "name": "operator",
              "type": "address",
              "internalType": "address"
            },
            { "name": "buyer", "type": "address", "internalType": "address" },
            { "name": "token", "type": "address", "internalType": "address" },
            {
              "name": "captureAddress",
              "type": "address",
              "internalType": "address"
            },
            { "name": "value", "type": "uint256", "internalType": "uint256" },
            {
              "name": "captureDeadline",
              "type": "uint48",
              "internalType": "uint48"
            },
            {
              "name": "feeRecipient",
              "type": "address",
              "internalType": "address"
            },
            { "name": "feeBps", "type": "uint16", "internalType": "uint16" }
          ]
        },
        { "name": "validAfter", "type": "uint256", "internalType": "uint256" },
        { "name": "validBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "value", "type": "uint256", "internalType": "uint256" },
        { "name": "signature", "type": "bytes", "internalType": "bytes" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "capture",
      "inputs": [
        { "name": "paymentHash", "type": "bytes32", "internalType": "bytes32" },
        { "name": "value", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "charge",
      "inputs": [
        { "name": "salt", "type": "uint256", "internalType": "uint256" },
        {
          "name": "details",
          "type": "tuple",
          "internalType": "struct PaymentEscrow.PaymentDetails",
          "components": [
            {
              "name": "operator",
              "type": "address",
              "internalType": "address"
            },
            { "name": "buyer", "type": "address", "internalType": "address" },
            { "name": "token", "type": "address", "internalType": "address" },
            {
              "name": "captureAddress",
              "type": "address",
              "internalType": "address"
            },
            { "name": "value", "type": "uint256", "internalType": "uint256" },
            {
              "name": "captureDeadline",
              "type": "uint48",
              "internalType": "uint48"
            },
            {
              "name": "feeRecipient",
              "type": "address",
              "internalType": "address"
            },
            { "name": "feeBps", "type": "uint16", "internalType": "uint16" }
          ]
        },
        { "name": "value", "type": "uint256", "internalType": "uint256" },
        { "name": "signature", "type": "bytes", "internalType": "bytes" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "erc6492Validator",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract PublicERC6492Validator"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "refund",
      "inputs": [
        { "name": "paymentHash", "type": "bytes32", "internalType": "bytes32" },
        { "name": "value", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "void",
      "inputs": [
        { "name": "paymentHash", "type": "bytes32", "internalType": "bytes32" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "event",
      "name": "PaymentAuthorized",
      "inputs": [
        {
          "name": "paymentDetailsHash",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "value",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PaymentCaptured",
      "inputs": [
        {
          "name": "paymentDetailsHash",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "value",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PaymentCharged",
      "inputs": [
        {
          "name": "paymentDetailsHash",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "value",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PaymentRefunded",
      "inputs": [
        {
          "name": "paymentDetailsHash",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        },
        {
          "name": "refunder",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "value",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PaymentVoided",
      "inputs": [
        {
          "name": "paymentDetailsHash",
          "type": "bytes32",
          "indexed": true,
          "internalType": "bytes32"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "AfterCaptureDeadline",
      "inputs": [
        { "name": "timestamp", "type": "uint48", "internalType": "uint48" },
        { "name": "deadline", "type": "uint48", "internalType": "uint48" }
      ]
    },
    {
      "type": "error",
      "name": "BeforeCaptureDeadline",
      "inputs": [
        { "name": "timestamp", "type": "uint48", "internalType": "uint48" },
        { "name": "deadline", "type": "uint48", "internalType": "uint48" }
      ]
    },
    {
      "type": "error",
      "name": "FeeBpsOverflow",
      "inputs": [
        { "name": "feeBps", "type": "uint16", "internalType": "uint16" }
      ]
    },
    {
      "type": "error",
      "name": "InsufficientAuthorization",
      "inputs": [
        {
          "name": "paymentDetailsHash",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "authorizedValue",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "requestedValue",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "InvalidSender",
      "inputs": [
        { "name": "sender", "type": "address", "internalType": "address" }
      ]
    },
    {
      "type": "error",
      "name": "PaymentNotRegistered",
      "inputs": [
        { "name": "paymentHash", "type": "bytes32", "internalType": "bytes32" }
      ]
    },
    { "type": "error", "name": "PermissionApprovalFailed", "inputs": [] },
    {
      "type": "error",
      "name": "RefundExceedsCapture",
      "inputs": [
        { "name": "refund", "type": "uint256", "internalType": "uint256" },
        { "name": "captured", "type": "uint256", "internalType": "uint256" }
      ]
    },
    {
      "type": "error",
      "name": "ValueLimitExceeded",
      "inputs": [
        { "name": "value", "type": "uint256", "internalType": "uint256" }
      ]
    },
    {
      "type": "error",
      "name": "VoidAuthorization",
      "inputs": [
        {
          "name": "paymentDetailsHash",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    { "type": "error", "name": "ZeroFeeRecipient", "inputs": [] },
    { "type": "error", "name": "ZeroValue", "inputs": [] }
  ] as const satisfies Abi;
