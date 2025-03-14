import { createPublicClient, createWalletClient, http, parseEther, Address, Hash, encodePacked, keccak256, WalletClient, encodeAbiParameters } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { PaymentEscrowCalldataOptimizedAbi, PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS } from '../abi/PaymentEscrowCalldataOptimized'

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
const USDC_DECIMALS = 6
const PAYMENT_AMOUNT = BigInt(0.01 * 10**USDC_DECIMALS) // 10000 (0.01 USDC)
const CAPTURE_ADDRESS = "0x2D893743B2A94Ac1695b5bB38dA965C49cf68450"; // amie.base.eth
const CAPTURE_DEADLINE = Math.floor(Date.now() / 1000) + 3600;
const VALID_AFTER = BigInt(0);
const VALID_BEFORE = BigInt(Math.floor(Date.now() / 1000) + 7200); // 2 hours from now
const SALT = BigInt(123);

// Add the RECEIVE_WITH_AUTHORIZATION_TYPEHASH constant
const RECEIVE_WITH_AUTHORIZATION_TYPEHASH = '0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8' as const;

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


// Helper Functions
function createPaymentDetails(
  operator: Address,
  buyer: Address,
): PaymentDetails {
  return {
    operator,
    buyer,
    token: USDC_ADDRESS,
    captureAddress: CAPTURE_ADDRESS,
    value: PAYMENT_AMOUNT,
    captureDeadline: CAPTURE_DEADLINE, // 1 hour from now
    feeRecipient: '0x0000000000000000000000000000000000000000',
    feeBps: 0
  }
}

async function generateERC3009Signature(
  walletClient: WalletClient,
  paymentDetails: PaymentDetails,
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
        SALT
      ]
    )
  )

  console.log('Payment Hash (nonce):', paymentHash)
  console.log('Signing data:', {
    from: paymentDetails.buyer,
    to: PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS,
    value: paymentDetails.value.toString(),
    validAfter: VALID_AFTER.toString(),
    validBefore: VALID_BEFORE.toString(),
    nonce: paymentHash
  })

  const signature = await walletClient.signTypedData({
    account,
    domain: ERC3009_DOMAIN,
    types: ERC3009_TYPES,
    primaryType: 'ReceiveWithAuthorization',
    message: {
      from: paymentDetails.buyer,
      to: PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS,
      value: paymentDetails.value,
      validAfter: VALID_AFTER,
      validBefore: VALID_BEFORE,
      nonce: paymentHash
    }
  })

  return signature
}

async function authorizePayment(
  paymentDetails: PaymentDetails,
  signature: `0x${string}`,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS,
    abi: PaymentEscrowCalldataOptimizedAbi,
    functionName: 'authorize',
    args: [
      SALT,
      paymentDetails,
      VALID_AFTER, // validAfter
      VALID_BEFORE, // validBefore
      paymentDetails.value,
      signature
    ]
  })

  return hash
}

// Main experiment function
async function runExperiment() {
  try {
    const salt = BigInt(Math.floor(Math.random() * 1000000))

    // Create payment details
    const paymentDetails = createPaymentDetails(
      account.address,
      account.address  )

    // Generate signature
    console.log('Generating ERC-3009 signature...')
    const signature = await generateERC3009Signature(
      walletClient,
      paymentDetails,
    )
    console.log('Signature generated:', signature)

    // Submit transaction
    console.log('Submitting authorize transaction...')
    const txHash = await authorizePayment(paymentDetails, signature)
    console.log('Transaction submitted:', txHash)

    // Wait for receipt and analyze gas usage
    console.log('Waiting for transaction receipt...')
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    
    console.log('\nTransaction Receipt Analysis:')
    console.log('Gas Used:', receipt.gasUsed.toString())
    console.log('Effective Gas Price:', receipt.effectiveGasPrice.toString())
    console.log('Total Gas Cost:', (receipt.gasUsed * receipt.effectiveGasPrice).toString())
    console.log('L1 Gas Used:', receipt.l1GasUsed?.toString() ?? 'N/A')
    console.log('L1 Gas Price:', receipt.l1GasPrice?.toString() ?? 'N/A')
    console.log('L1 Fee:', receipt.l1Fee?.toString() ?? 'N/A')
    
    return receipt
  } catch (error) {
    console.error('Error in experiment:', error)
    throw error
  }
}

// Export for use in other files
export { runExperiment, createPaymentDetails, generateERC3009Signature, authorizePayment } 