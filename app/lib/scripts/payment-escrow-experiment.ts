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

// Update the log function type to accept HTML
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
    feeRecipient: '0x0000000000000000000000000000000000000000' as Address,
    feeBps: 0
  }
  
  logToUI(`Buyer Address: ${details.buyer}`);
  logToUI(`Payment Amount: ${details.value.toString()}`);
  logToUI(`Operator Address: ${details.operator}`);
  
  return details;
}

const BASESCAN_URL = 'https://basescan.org/tx'

function calculatePaymentHash(
  paymentDetails: PaymentDetails,
  salt: bigint
): Hash {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'uint256' },  // value
        { type: 'uint256' },  // validAfter
        { type: 'uint256' },  // validBefore
        { type: 'uint48' },   // captureDeadline
        { type: 'address' },  // operator
        { type: 'address' },  // captureAddress
        { type: 'uint16' },   // feeBps
        { type: 'address' },  // feeRecipient
        { type: 'address' },  // token
        { type: 'uint256' }   // salt
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
}

async function generateERC3009Signature_calldataOptimized(
  walletClient: WalletClient,
  paymentDetails: PaymentDetails,
  salt: bigint,
  targetContract: Address
): Promise<`0x${string}`> {
  // Create the payment hash using abi.encode format
  const paymentHash = calculatePaymentHash(paymentDetails, salt)

  // logToUI(`Payment Hash (nonce): ${paymentHash}`)
  // logToUI(`From: ${paymentDetails.buyer}`)
  // logToUI(`To: ${targetContract}`)
  // logToUI(`Value: ${paymentDetails.value.toString()}`)
  // logToUI(`Valid After: ${VALID_AFTER.toString()}`)
  // logToUI(`Valid Before: ${VALID_BEFORE.toString()}`)

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

  // logToUI(`Payment Hash (nonce): ${paymentHash}`)
  // logToUI(`From: ${paymentDetails.buyer}`)
  // logToUI(`To: ${targetContract}`)
  // logToUI(`Value: ${paymentDetails.value.toString()}`)
  // logToUI(`Valid After: ${VALID_AFTER.toString()}`)
  // logToUI(`Valid Before: ${VALID_BEFORE.toString()}`)

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
  
  // // Log the values we're encoding
  // logToUI('Encoding payment details:')
  // logToUI(`Token: ${paymentDetails.token}`)
  // logToUI(`Buyer: ${paymentDetails.buyer}`)
  // logToUI(`Value: ${paymentDetails.value.toString()}`)
  // logToUI(`ValidAfter: ${VALID_AFTER.toString()}`)
  // logToUI(`ValidBefore: ${VALID_BEFORE.toString()}`)
  // logToUI(`CaptureDeadline: ${paymentDetails.captureDeadline}`)
  // logToUI(`Operator: ${paymentDetails.operator}`)
  // logToUI(`CaptureAddress: ${paymentDetails.captureAddress}`)
  // logToUI(`FeeBps: ${paymentDetails.feeBps}`)
  // logToUI(`FeeRecipient: ${paymentDetails.feeRecipient}`)
  // logToUI(`Salt: ${SALT_GAS_OPT.toString()}`)

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

async function capturePaymentCalldata(
  paymentDetails: PaymentDetails,
  paymentHash: Hash,
): Promise<Hash> {
  logToUI('\nCapturing payment in Calldata Optimized Contract...')
  
  const hash = await walletClient.writeContract({
    address: PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS,
    abi: PaymentEscrowCalldataOptimizedAbi,
    functionName: 'capture',
    args: [
      paymentHash,
      paymentDetails.value
    ]
  })

  return hash
}

async function capturePaymentGas(
  paymentDetails: PaymentDetails,
): Promise<Hash> {
  logToUI('\nCapturing payment in Gas Optimized Contract...')
  
  // Encode the Authorization struct
  const encodedDetails = encodeAbiParameters(
    [{
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
    }],
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

  const hash = await walletClient.writeContract({
    address: PAYMENT_ESCROW_GAS_OPTIMIZED_ADDRESS,
    abi: PaymentEscrowGasOptimizedAbi,
    functionName: 'capture',
    args: [
      paymentDetails.value,
      encodedDetails
    ]
  })

  return hash
}

function logGasMetrics(receipt: any, description: string): bigint {
  // L2 Calculations
  const l2Gas = receipt.gasUsed
  const l2GasPrice = receipt.effectiveGasPrice
  const l2Fee = BigInt(l2Gas) * BigInt(l2GasPrice)

  // L1 Calculations
  const l1Gas = receipt.l1GasUsed
  const l1GasPrice = receipt.l1GasPrice
  const l1Fee = BigInt(receipt.l1Fee)

  // Total Fee
  const totalFee = l2Fee + l1Fee

  logToUI(`\n${description} Gas Metrics:`)
  logToUI('L2:')
  logToUI(`  Gas Used: ${l2Gas}`)
  logToUI(`  Gas Price: ${l2GasPrice} wei`)
  logToUI(`  Fee: ${l2Fee} wei (${formatEth(l2Fee)} ETH)`)
  
  logToUI('\nL1:')
  logToUI(`  Gas Used: ${l1Gas}`)
  logToUI(`  Gas Price: ${l1GasPrice} wei`)
  logToUI(`  Fee: ${l1Fee} wei (${formatEth(l1Fee)} ETH)`)
  
  logToUI('\nTotal:')
  logToUI(`  Total Fee: ${totalFee} wei (${formatEth(totalFee)} ETH)`)
  logToUI('----------------------------------------')

  return totalFee
}

// Helper to format wei to ETH with better precision
function formatEth(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(6)
}

// Updated main experiment function
async function runExperiment() {
  try {
    logToUI('Starting experiment...')
    
    // Log contract addresses
    logToUI('\nContract Addresses:')
    logToUI(`Calldata Optimized: ${PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS}`)
    logToUI(`Gas Optimized: ${PAYMENT_ESCROW_GAS_OPTIMIZED_ADDRESS}`)
    logToUI('----------------------------------------')

    // Create payment details (same for both contracts)
    const paymentDetails = createPaymentDetails(
      account.address,
      account.address
    )

    // Test Calldata Optimized Contract
    logToUI('\n=== Testing Calldata Optimized Contract ===')
    const paymentHash = calculatePaymentHash(paymentDetails, SALT_CALLDATA_OPT)
    const signature1 = await generateERC3009Signature_calldataOptimized(
      walletClient, 
      paymentDetails, 
      SALT_CALLDATA_OPT,
      PAYMENT_ESCROW_CALLDATA_OPTIMIZED_ADDRESS
    )
    const txHash1 = await authorizePaymentCalldata(paymentDetails, signature1)
    logToUI(`Authorization submitted: ${BASESCAN_URL}/${txHash1}`)
    const receipt1 = await publicClient.waitForTransactionReceipt({ hash: txHash1 })
    const calldataAuthFee = logGasMetrics(receipt1, 'Calldata Optimized Authorization')

    const captureTxHash = await capturePaymentCalldata(paymentDetails, paymentHash)
    logToUI(`Capture submitted: ${BASESCAN_URL}/${captureTxHash}`)
    const captureReceipt1 = await publicClient.waitForTransactionReceipt({ hash: captureTxHash })
    const calldataCaptureFee = logGasMetrics(captureReceipt1, 'Calldata Optimized Capture')

    const calldataTotalFee = calldataAuthFee + calldataCaptureFee
    logToUI('\nCalldata Optimized Total Sequence:')
    logToUI(`  Total Fee for Auth + Capture: ${calldataTotalFee} wei (${formatEth(calldataTotalFee)} ETH)`)
    logToUI('----------------------------------------')

    // Test Gas Optimized Contract
    logToUI('\n=== Testing Gas Optimized Contract ===')
    const signature2 = await generateERC3009Signature_gasOptimized(
      walletClient, 
      paymentDetails, 
      SALT_GAS_OPT,
      PAYMENT_ESCROW_GAS_OPTIMIZED_ADDRESS
    )
    const txHash2 = await authorizePaymentGas(paymentDetails, signature2)
    logToUI(`Authorization submitted: ${BASESCAN_URL}/${txHash2}`)
    const receipt2 = await publicClient.waitForTransactionReceipt({ hash: txHash2 })
    const gasAuthFee = logGasMetrics(receipt2, 'Gas Optimized Authorization')

    const captureTxHash2 = await capturePaymentGas(paymentDetails)
    logToUI(`Capture submitted: ${BASESCAN_URL}/${captureTxHash2}`)
    const captureReceipt2 = await publicClient.waitForTransactionReceipt({ hash: captureTxHash2 })
    const gasCaptureFee = logGasMetrics(captureReceipt2, 'Gas Optimized Capture')

    const gasTotalFee = gasAuthFee + gasCaptureFee
    logToUI('\nGas Optimized Total Sequence:')
    logToUI(`  Total Fee for Auth + Capture: ${gasTotalFee} wei (${formatEth(gasTotalFee)} ETH)`)
    logToUI('----------------------------------------')

    // Final comparison
    logToUI('\nGas Usage Comparison:')
    logToUI('----------------------------------------')
    logToUI('Operation          | L2 Gas | L2 Fee (wei)     | L1 Gas | L1 Fee (wei)     | Total Fee (wei)')
    logToUI('------------------ | ------ | ---------------- | ------ | ---------------- | ----------------')
    
    // Calldata Optimized Auth
    const cdAuthL2Fee = BigInt(receipt1.gasUsed) * BigInt(receipt1.effectiveGasPrice)
    logToUI(
      'Calldata Auth     | ' +
      `${receipt1.gasUsed.toString().padEnd(6)} | ` +
      `${cdAuthL2Fee.toString().padEnd(16)} | ` +
      `${receipt1?.l1GasUsed?.toString().padEnd(6)} | ` +
      `${BigInt(receipt1?.l1Fee ?? 0).toString().padEnd(16)} | ` +
      `${calldataAuthFee.toString()}`
    )

    // Calldata Optimized Capture
    const cdCaptureL2Fee = BigInt(captureReceipt1.gasUsed) * BigInt(captureReceipt1.effectiveGasPrice)
    logToUI(
      'Calldata Capture  | ' +
      `${captureReceipt1.gasUsed.toString().padEnd(6)} | ` +
      `${cdCaptureL2Fee.toString().padEnd(16)} | ` +
      `${captureReceipt1?.l1GasUsed?.toString().padEnd(6)} | ` +
      `${BigInt(captureReceipt1?.l1Fee ?? 0).toString().padEnd(16)} | ` +
      `${calldataCaptureFee.toString()}`
    )

    // Gas Optimized Auth
    const gasAuthL2Fee = BigInt(receipt2.gasUsed) * BigInt(receipt2.effectiveGasPrice)
    logToUI(
      'Gas Opt Auth      | ' +
      `${receipt2.gasUsed.toString().padEnd(6)} | ` +
      `${gasAuthL2Fee.toString().padEnd(16)} | ` +
      `${receipt2?.l1GasUsed?.toString().padEnd(6)} | ` +
      `${BigInt(receipt2?.l1Fee ?? 0).toString().padEnd(16)} | ` +
      `${gasAuthFee.toString()}`
    )

    // Gas Optimized Capture
    const gasCaptureL2Fee = BigInt(captureReceipt2.gasUsed) * BigInt(captureReceipt2.effectiveGasPrice)
    logToUI(
      'Gas Opt Capture   | ' +
      `${captureReceipt2.gasUsed.toString().padEnd(6)} | ` +
      `${gasCaptureL2Fee.toString().padEnd(16)} | ` +
      `${captureReceipt2?.l1GasUsed?.toString().padEnd(6)} | ` +
      `${BigInt(captureReceipt2?.l1Fee ?? 0).toString().padEnd(16)} | ` +
      `${gasCaptureFee.toString()}`
    )

    logToUI('------------------ | ------ | ---------------- | ------ | ---------------- | ----------------')
    logToUI(
      'TOTALS            | ' +
      `${(receipt1.gasUsed + captureReceipt1.gasUsed).toString().padEnd(6)} | ` +
      `${(cdAuthL2Fee + cdCaptureL2Fee).toString().padEnd(16)} | ` +
      `${(Number(receipt1?.l1GasUsed ?? 0) + Number(captureReceipt1?.l1GasUsed ?? 0)).toString().padEnd(6)} | ` +
      `${(BigInt(receipt1?.l1Fee ?? 0) + BigInt(captureReceipt1?.l1Fee ?? 0)).toString().padEnd(16)} | ` +
      `${calldataTotalFee.toString()}`
    )
    logToUI(
      '                  | ' +
      `${(receipt2.gasUsed + captureReceipt2.gasUsed).toString().padEnd(6)} | ` +
      `${(gasAuthL2Fee + gasCaptureL2Fee).toString().padEnd(16)} | ` +
      `${(Number(receipt2?.l1GasUsed ?? 0) + Number(captureReceipt2?.l1GasUsed ?? 0)).toString().padEnd(6)} | ` +
      `${(BigInt(receipt2?.l1Fee ?? 0) + BigInt(captureReceipt2?.l1Fee ?? 0)).toString().padEnd(16)} | ` +
      `${gasTotalFee.toString()}`
    )
    logToUI('----------------------------------------')

    // Show the difference and percentages
    const savings = calldataTotalFee > gasTotalFee ? 
      calldataTotalFee - gasTotalFee : 
      gasTotalFee - calldataTotalFee;
    
    const savingsPercent = calldataTotalFee > gasTotalFee ?
      (Number(savings) / Number(calldataTotalFee) * 100).toFixed(2) :
      (Number(savings) / Number(gasTotalFee) * 100).toFixed(2);

    const diff = calldataTotalFee > gasTotalFee ? 
      `Gas Optimized saved ${savings} wei (${savingsPercent}% cheaper)` :
      `Calldata Optimized saved ${savings} wei (${savingsPercent}% cheaper)`
    
    logToUI(`\n${diff}`)

    return {
      calldataOptimized: {
        authorize: receipt1,
        capture: captureReceipt1
      },
      gasOptimized: {
        authorize: receipt2,
        capture: captureReceipt2
      }
    }
  } catch (error) {
    logToUI(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

// Export for use in other files
export { runExperiment, createPaymentDetails, generateERC3009Signature_calldataOptimized as generateERC3009Signature, authorizePaymentCalldata, authorizePaymentGas } 