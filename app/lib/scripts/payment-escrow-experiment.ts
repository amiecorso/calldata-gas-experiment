import { createPublicClient, createWalletClient, http, parseEther, Address, Hash, encodePacked, keccak256, WalletClient, encodeAbiParameters } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { PaymentEscrowCalldataOptimizedAbi, PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS } from '../abi/PaymentEscrowCalldataOptimized'
import { PaymentEscrowGasOptimizedAbi, PAYMENT_ESCROW_GAS_OPTIMIZED_ADDRESS } from '../abi/PaymentEscrowGasOptimized'

// Types
type ExtendedAccount = ReturnType<typeof privateKeyToAccount> & {
  _privateKey: Hash;
};

type PaymentDetails = {
  operator: Address
  buyer: Address
  token: Address
  captureAddress: Address
  value: bigint
  captureDeadline: number
  feeRecipient: Address
  feeBps: number
}

// Constants
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const // Base USDC
const PAYMENT_AMOUNT = BigInt(10000); 
const CAPTURE_ADDRESS = "0x2D893743B2A94Ac1695b5bB38dA965C49cf68450"; // amie.base.eth
const CAPTURE_DEADLINE = Math.floor(Date.now() / 1000) + 3600;
const VALID_AFTER = BigInt(0);
const VALID_BEFORE = BigInt(Math.floor(Date.now() / 1000) + 7200); // 2 hours from now
const SALT_CALLDATA_OPT = BigInt(123);
const SALT_GAS_OPT = BigInt(456);
// ERC-3009 Domain
const ERC3009_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: base.id,
  verifyingContract: USDC_ADDRESS,
  salt: undefined // Changed from null to undefined
} as const;

// ERC-3009 Types
const ERC3009_TYPES = {
  ReceiveWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

// Create extended account with private key
const account: ExtendedAccount = {
  ...privateKeyToAccount(process.env.NEXT_PUBLIC_WALLET_PRIVATE_KEY as Hash),
  _privateKey: process.env.NEXT_PUBLIC_WALLET_PRIVATE_KEY as Hash
}

// Clients setup
const publicClient = createPublicClient({
  chain: base,
  transport: http()
})

// Create wallet client with extended account
const walletClient = createWalletClient({
    chain: base,
    transport: http(),
    account
  })

// Add this at the top of the file
let logToUI: (message: string) => void = console.log;
export function setLogFunction(fn: typeof logToUI) {
  logToUI = fn;
}

// Helper Functions
function createPaymentDetails(
  operator: Address,
  buyer: Address,
): PaymentDetails {
  const details = {
    operator,
    buyer,
    token: USDC_ADDRESS,
    captureAddress: CAPTURE_ADDRESS as Address,
    value: PAYMENT_AMOUNT,
    captureDeadline: CAPTURE_DEADLINE,
    feeRecipient: '0x0000000000000000000000000000000000000000',
    feeBps: 0
  }
  
  logToUI(`Buyer Address: ${details.buyer}`);
  logToUI(`Payment Amount: ${details.value.toString()}`);
  logToUI(`Operator Address: ${details.operator}`);
  
  return details;
}

const BASESCAN_URL = 'https://basescan.org/tx'

async function generateERC3009Signature_calldataOptimized(
  walletClient: WalletClient,
  paymentDetails: PaymentDetails,
  salt: bigint,
  targetContract: Address
): Promise<`0x${string}`> {
  // Create the payment hash using abi.encode format
  const paymentHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint48' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint16' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' }
      ],
      [
        paymentDetails.value,
        VALID_AFTER,
        VALID_BEFORE,
        paymentDetails.captureDeadline,
        paymentDetails.operator,
        paymentDetails.captureAddress,
        paymentDetails.feeBps,
        paymentDetails.feeRecipient,
        paymentDetails.token,
        salt
      ]
    )
  )

  logToUI(`Payment Hash (nonce): ${paymentHash}`)
  logToUI(`From: ${paymentDetails.buyer}`)
  logToUI(`To: ${targetContract}`)
  logToUI(`Value: ${paymentDetails.value.toString()}`)
  logToUI(`Valid After: ${VALID_AFTER.toString()}`)
  logToUI(`Valid Before: ${VALID_BEFORE.toString()}`)

  const signature = await walletClient.signTypedData({
    account,
    domain: ERC3009_DOMAIN,
    types: ERC3009_TYPES,
    primaryType: 'ReceiveWithAuthorization',
    message: {
      from: paymentDetails.buyer,
      to: targetContract,
      value: paymentDetails.value,
      validAfter: VALID_AFTER,
      validBefore: VALID_BEFORE,
      nonce: paymentHash
    }
  })

  return signature
}

async function generateERC3009Signature_gasOptimized(
  walletClient: WalletClient,
  paymentDetails: PaymentDetails,
  salt: bigint,
  targetContract: Address
): Promise<`0x${string}`> {
  // Create the payment hash using abi.encode format matching the Authorization struct
  const paymentHash = keccak256(
    encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'token', type: 'address' },
            { name: 'buyer', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'captureDeadline', type: 'uint48' },
            { name: 'operator', type: 'address' },
            { name: 'captureAddress', type: 'address' },
            { name: 'feeBps', type: 'uint16' },
            { name: 'feeRecipient', type: 'address' },
            { name: 'salt', type: 'uint256' }
          ]
        }
      ],
      [{
        token: paymentDetails.token,
        buyer: paymentDetails.buyer,
        value: paymentDetails.value,
        validAfter: VALID_AFTER,
        validBefore: VALID_BEFORE,
        captureDeadline: paymentDetails.captureDeadline,
        operator: paymentDetails.operator,
        captureAddress: paymentDetails.captureAddress,
        feeBps: paymentDetails.feeBps,
        feeRecipient: paymentDetails.feeRecipient,
        salt: salt
      }]
    )
  )

  logToUI(`Payment Hash (nonce): ${paymentHash}`)
  logToUI(`From: ${paymentDetails.buyer}`)
  logToUI(`To: ${targetContract}`)
  logToUI(`Value: ${paymentDetails.value.toString()}`)
  logToUI(`Valid After: ${VALID_AFTER.toString()}`)
  logToUI(`Valid Before: ${VALID_BEFORE.toString()}`)

  const signature = await walletClient.signTypedData({
    account,
    domain: ERC3009_DOMAIN,
    types: ERC3009_TYPES,
    primaryType: 'ReceiveWithAuthorization',
    message: {
      from: paymentDetails.buyer,
      to: targetContract,
      value: paymentDetails.value,
      validAfter: VALID_AFTER,
      validBefore: VALID_BEFORE,
      nonce: paymentHash
    }
  })

  return signature
}

async function authorizePaymentCalldata(
  paymentDetails: PaymentDetails,
  signature: `0x${string}`,
): Promise<Hash> {
  logToUI('\nSubmitting to Calldata Optimized Contract...')
  const hash = await walletClient.writeContract({
    address: PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS,
    abi: PaymentEscrowCalldataOptimizedAbi,
    functionName: 'authorize',
    args: [
      SALT_CALLDATA_OPT,
      paymentDetails,
      VALID_AFTER,
      VALID_BEFORE,
      paymentDetails.value,
      signature
    ]
  })

  return hash
}

async function authorizePaymentGas(
  paymentDetails: PaymentDetails,
  signature: `0x${string}`,
): Promise<Hash> {
  logToUI('\nSubmitting to Gas Optimized Contract...')
  
  // Log the values we're encoding
  logToUI('Encoding payment details:')
  logToUI(`Token: ${paymentDetails.token}`)
  logToUI(`Buyer: ${paymentDetails.buyer}`)
  logToUI(`Value: ${paymentDetails.value.toString()}`)
  logToUI(`ValidAfter: ${VALID_AFTER.toString()}`)
  logToUI(`ValidBefore: ${VALID_BEFORE.toString()}`)
  logToUI(`CaptureDeadline: ${paymentDetails.captureDeadline}`)
  logToUI(`Operator: ${paymentDetails.operator}`)
  logToUI(`CaptureAddress: ${paymentDetails.captureAddress}`)
  logToUI(`FeeBps: ${paymentDetails.feeBps}`)
  logToUI(`FeeRecipient: ${paymentDetails.feeRecipient}`)
  logToUI(`Salt: ${SALT_GAS_OPT.toString()}`)

  const encodedDetails = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'buyer', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'captureDeadline', type: 'uint48' },
          { name: 'operator', type: 'address' },
          { name: 'captureAddress', type: 'address' },
          { name: 'feeBps', type: 'uint16' },
          { name: 'feeRecipient', type: 'address' },
          { name: 'salt', type: 'uint256' }
        ]
      }
    ],
    [{
      token: paymentDetails.token,
      buyer: paymentDetails.buyer,
      value: paymentDetails.value,
      validAfter: VALID_AFTER,
      validBefore: VALID_BEFORE,
      captureDeadline: paymentDetails.captureDeadline,
      operator: paymentDetails.operator,
      captureAddress: paymentDetails.captureAddress,
      feeBps: paymentDetails.feeBps,
      feeRecipient: paymentDetails.feeRecipient,
      salt: SALT_GAS_OPT
    }]
  )

  logToUI(`Encoded details: ${encodedDetails}`)

  const hash = await walletClient.writeContract({
    address: PAYMENT_ESCROW_GAS_OPTIMIZED_ADDRESS,
    abi: PaymentEscrowGasOptimizedAbi,
    functionName: 'authorize',
    args: [
      paymentDetails.value,
      encodedDetails,
      signature
    ]
  })

  return hash
}

// Updated main experiment function
async function runExperiment() {
  try {
    logToUI('Starting experiment...')
    const salt = BigInt(Math.floor(Math.random() * 1000000))
    logToUI(`Generated salt: ${salt.toString()}`)

    // Create payment details (same for both contracts)
    logToUI('Creating payment details...')
    const paymentDetails = createPaymentDetails(
      account.address,
      account.address
    )
    logToUI('Payment details created successfully')

    // Test Calldata Optimized Contract
    logToUI('\n=== Testing Calldata Optimized Contract ===')
    const signature1 = await generateERC3009Signature_calldataOptimized(
      walletClient, 
      paymentDetails, 
      SALT_CALLDATA_OPT,
      PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS
    )
    logToUI('Signature generated for calldata optimized contract')
    const txHash1 = await authorizePaymentCalldata(paymentDetails, signature1)
    logToUI(`Transaction submitted: ${BASESCAN_URL}/${txHash1}`)
    const receipt1 = await publicClient.waitForTransactionReceipt({ hash: txHash1 })
    logToUI('\nCalldata Optimized Contract Receipt:')
    logToUI(JSON.stringify(receipt1, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2))

    // Test Gas Optimized Contract
    logToUI('\n=== Testing Gas Optimized Contract ===')
    const signature2 = await generateERC3009Signature_gasOptimized(
      walletClient, 
      paymentDetails, 
      SALT_GAS_OPT,
      PAYMENT_ESCROW_GAS_OPTIMIZED_ADDRESS
    )
    logToUI('Signature generated for gas optimized contract')
    const txHash2 = await authorizePaymentGas(paymentDetails, signature2)
    logToUI(`Transaction submitted: ${BASESCAN_URL}/${txHash2}`)
    const receipt2 = await publicClient.waitForTransactionReceipt({ hash: txHash2 })
    logToUI('\nGas Optimized Contract Receipt:')
    logToUI(JSON.stringify(receipt2, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2))

    return {
      calldataOptimized: receipt1,
      gasOptimized: receipt2
    }
  } catch (error) {
    logToUI(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

// Export for use in other files
export { runExperiment, createPaymentDetails, generateERC3009Signature_calldataOptimized as generateERC3009Signature, authorizePaymentCalldata, authorizePaymentGas } 