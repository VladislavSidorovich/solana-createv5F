import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { ChangeEvent, FC, useCallback, useState, useEffect } from "react";
import { notify } from "utils/notifications";
import { ClipLoader } from "react-spinners";
import { useNetworkConfiguration } from "contexts/NetworkConfigurationProvider";

// Constants
const JWT_IPFS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2ZTg3NjJlNC0xOGY4LTQwMzgtYTRiMy1jMTFkMTI4NDJiZjYiLCJlbWFpbCI6ImFmZmlsaWF0ZWtpeEBtYWlsLnJ1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjJiMTI0MTI5Y2E2YTJmNjgzYTU3Iiwic2NvcGVkS2V5U2VjcmV0IjoiMjRlMjRmZGIxMTgzMjQ2ZWU2OGYyZWJhOTA4ZDYwM2U4Mzg0MTg3NjI4OTMwOGQwZWI2NDE4ODc2MDk0YmQ0ZCIsImV4cCI6MTc3MzU3OTcxOX0.zuu_Dt7gu8PZFJETVS61umGIRgbShQZATAen-cWRweM";
const FEE_RECEIVER = new PublicKey("HHN3raM19q3kuVb8hQwFG8mi4rUR8ztbxX4vG8XudFNB");
const BASE_FEE_LAMPORTS = 0.1 * LAMPORTS_PER_SOL;
const AUTHORITY_FEE_LAMPORTS = 0.1 * LAMPORTS_PER_SOL;

export const CreateToken: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { networkConfiguration } = useNetworkConfiguration();

  // Form state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("9");
  const [tokenDescription, setTokenDescription] = useState("");
  const [amount, setAmount] = useState("1000");
  const [revokeMintAuthority, setRevokeMintAuthority] = useState(false);
  const [revokeFreezeAuthority, setRevokeFreezeAuthority] = useState(false);

  // Process state
  const [tokenMintAddress, setTokenMintAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [totalFee, setTotalFee] = useState(BASE_FEE_LAMPORTS / LAMPORTS_PER_SOL);

  // Calculate total fee whenever authority options change
  useEffect(() => {
    let fee = BASE_FEE_LAMPORTS;
    if (revokeMintAuthority) fee += AUTHORITY_FEE_LAMPORTS;
    if (revokeFreezeAuthority) fee += AUTHORITY_FEE_LAMPORTS;
    setTotalFee(fee / LAMPORTS_PER_SOL);
  }, [revokeMintAuthority, revokeFreezeAuthority]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const uploadMetadata = async (): Promise<string> => {
    if (!imageFile) throw new Error("No image file selected");
    
    try {
      // Upload image to IPFS
      const imageFormData = new FormData();
      imageFormData.append("file", imageFile);
      
      const imageResponse = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${JWT_IPFS_TOKEN}`,
          },
          body: imageFormData,
        }
      );
      
      if (!imageResponse.ok) {
        throw new Error("Failed to upload image to IPFS");
      }
      
      const imageData = await imageResponse.json();
      const imageUri = `https://ipfs.io/ipfs/${imageData.IpfsHash}`;

      // Create and upload metadata JSON
      const metadata = {
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription,
        image: imageUri,
      };
      
      const metadataResponse = await fetch(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${JWT_IPFS_TOKEN}`,
          },
          body: JSON.stringify(metadata),
        }
      );
      
      if (!metadataResponse.ok) {
        throw new Error("Failed to upload metadata to IPFS");
      }
      
      const metadataData = await metadataResponse.json();
      return `https://ipfs.io/ipfs/${metadataData.IpfsHash}`;
    } catch (error) {
      console.error("Metadata upload error:", error);
      throw error;
    }
  };

  const createToken = useCallback(async (metadataUri: string) => {
    if (!publicKey) {
      notify({ type: "error", message: "Wallet not connected!" });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Prepare accounts
      const mintKeypair = Keypair.generate();
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey
      );

      // 2. Build transaction
      const tx = new Transaction();

      // 2.1 Add base fee payment
      tx.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: FEE_RECEIVER,
          lamports: BASE_FEE_LAMPORTS,
        })
      );

      // 2.2 Create mint account and initialize
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          Number(tokenDecimals),
          publicKey, // mint authority
          publicKey, // freeze authority
          TOKEN_PROGRAM_ID
        )
      );

      // 2.3 Create metadata
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      tx.add(
        createCreateMetadataAccountV3Instruction(
          {
            metadata: metadataPDA,
            mint: mintKeypair.publicKey,
            mintAuthority: publicKey,
            payer: publicKey,
            updateAuthority: publicKey,
          },
          {
            createMetadataAccountArgsV3: {
              data: {
                name: tokenName,
                symbol: tokenSymbol,
                uri: metadataUri,
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null,
              },
              isMutable: false,
              collectionDetails: null,
            },
          }
        )
      );

      // 2.4 Create ATA and mint tokens
      tx.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          associatedTokenAccount,
          publicKey,
          mintKeypair.publicKey
        ),
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAccount,
          publicKey,
          BigInt(Number(amount) * 10 ** Number(tokenDecimals))
        )
      );

      // 2.5 Add authority revocations if selected
      if (revokeMintAuthority) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: FEE_RECEIVER,
            lamports: AUTHORITY_FEE_LAMPORTS,
          }),
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.MintTokens,
            null
          )
        );
      }

      if (revokeFreezeAuthority) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: FEE_RECEIVER,
            lamports: AUTHORITY_FEE_LAMPORTS,
          }),
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.FreezeAccount,
            null
          )
        );
      }

      // 3. Send transaction
      const signature = await sendTransaction(tx, connection, {
        signers: [mintKeypair],
      });

      await connection.confirmTransaction(signature, "confirmed");

      setTokenMintAddress(mintKeypair.publicKey.toString());
      notify({
        type: "success",
        message: "Token created successfully!",
        txid: signature,
      });

    } catch (error) {
      notify({ type: "error", message: `Error: ${error.message}` });
      console.error("Token creation failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    publicKey,
    connection,
    tokenName,
    tokenSymbol,
    tokenDecimals,
    amount,
    revokeMintAuthority,
    revokeFreezeAuthority,
    sendTransaction,
  ]);

  const handleCreateToken = async () => {
    if (!publicKey) {
      notify({ type: "error", message: "Wallet not connected!" });
      return;
    }

    if (!imageFile) {
      notify({ type: "error", message: "Please upload token image!" });
      return;
    }

    if (!tokenName || !tokenSymbol) {
      notify({ type: "error", message: "Token name and symbol are required!" });
      return;
    }

    try {
      setIsLoading(true);
      notify({ type: "info", message: "Uploading metadata to IPFS..." });
      
      const metadataUri = await uploadMetadata();
      
      notify({ type: "info", message: "Creating token on blockchain..." });
      await createToken(metadataUri);
      
    } catch (error) {
      notify({ type: "error", message: "Failed to create token" });
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Create New Token</h1>

      {!tokenMintAddress ? (
        <div className="space-y-6">
          {/* Token Image Upload */}
          <div>
            <label className="block mb-2 font-medium">Token Image*</label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              {imageFile ? (
                <div>
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt="Token preview"
                    className="mx-auto h-32 object-contain mb-3"
                  />
                  <p className="text-sm">{imageFile.name}</p>
                  <button
                    onClick={() => setImageFile(null)}
                    className="mt-2 text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-blue-600">
                      Upload token image
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={handleImageChange}
                    accept="image/*"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Token Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-medium">Token Name*</label>
              <input
                className="w-full p-3 text-gray-700 border rounded-lg"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="My Awesome Token"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">Token Symbol*</label>
              <input
                className="w-full p-3 text-gray-700 border rounded-lg"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                placeholder="MAT"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">Description</label>
              <input
                className="w-full p-3 text-gray-700 border rounded-lg"
                value={tokenDescription}
                onChange={(e) => setTokenDescription(e.target.value)}
                placeholder="Describe your token"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">Decimals</label>
              <input
                type="number"
                className="w-full p-3 text-gray-700 border rounded-lg"
                value={tokenDecimals}
                onChange={(e) => setTokenDecimals(e.target.value)}
                min={0}
                max={18}
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">Initial Supply</label>
              <input
                className="w-full p-3 text-gray-700 border rounded-lg"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Authority Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={revokeMintAuthority}
                  onChange={() => setRevokeMintAuthority(!revokeMintAuthority)}
                  className="h-5 w-5 text-gray-700 rounded"
                />
                <span className="ml-3">
                  <span className="block font-medium">Revoke Mint Authority</span>
                  <span className="block text-sm text-gray-500">
                    No one will be able to mint more tokens (+0.1 SOL fee)
                  </span>
                </span>
              </label>
            </div>

            <div className="p-4 border rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={revokeFreezeAuthority}
                  onChange={() => setRevokeFreezeAuthority(!revokeFreezeAuthority)}
                  className="h-5 w-5 text-gray-700 rounded"
                />
                <span className="ml-3">
                  <span className="block font-medium">Revoke Freeze Authority</span>
                  <span className="block text-sm text-gray-500">
                    No one will be able to freeze accounts (+0.1 SOL fee)
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Fee Summary */}
          <div className="p-4 bg-transparent rounded-lg ">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">Total Fee</h3>
                <p className="text-sm text-gray-600">
                  Includes token creation and selected options
                </p>
              </div>
              <div className="text-2xl font-bold">{totalFee} SOL</div>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateToken}
            disabled={isLoading || !publicKey}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <ClipLoader size={20} color="#fff" className="mr-2" />
                Creating Token...
              </span>
            ) : !publicKey ? (
              "Connect Wallet to Continue"
            ) : (
              "Create Token"
            )}
          </button>
        </div>
      ) : (
        <div className="text-center min-h-screen ">
          <div className="p-6 bg-transparent rounded-lg inline-block">
            <svg
              className="mx-auto h-12 w-12 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h2 className="mt-3 text-xl font-medium">Token Created Successfully!</h2>
            <p className="mt-2 text-gray-600">
              Your token has been deployed to the blockchain
            </p>
            <div className="mt-4 p-3 bg-transparent rounded border break-all">
              {tokenMintAddress}
            </div>
            <a
              href={`https://explorer.solana.com/address/${tokenMintAddress}?cluster=${networkConfiguration}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              View on Explorer
            </a>
          </div>
        </div>
      )}
    </div>
  );
};