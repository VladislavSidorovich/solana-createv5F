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
  setAuthority,
  AuthorityType,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import { ChangeEvent, FC, useCallback, useState, useEffect } from "react";
import { notify } from "utils/notifications";
import { ClipLoader } from "react-spinners";
import { useNetworkConfiguration } from "contexts/NetworkConfigurationProvider";
import { PinataSDK } from "pinata-web3";
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { INPUT_FLOAT_REGEX } from "../constants";

export const CreateToken: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { networkConfiguration } = useNetworkConfiguration();
  const [imageFile, setImageFile] = useState(null);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenUri, setTokenUri] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("9");
  const [tokenMintAddress, setTokenMintAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tokenDescription, setTokenDescription] = useState("");
  const [jsonUri, setJsonUri] = useState("");

  const [stapCreateToken, setstapCreateToken] = useState(false);
  const [staponClick, setstaponClick] = useState(false);
  const [staponClickAuthority, setstaponClickAuthority] = useState(false);
  const [totalFee, setTotalFee] = useState(0);
  
  const [amount, setAmount] = useState("0.0");

  const JWT_IPFS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2ZTg3NjJlNC0xOGY4LTQwMzgtYTRiMy1jMTFkMTI4NDJiZjYiLCJlbWFpbCI6ImFmZmlsaWF0ZWtpeEBtYWlsLnJ1IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjJiMTI0MTI5Y2E2YTJmNjgzYTU3Iiwic2NvcGVkS2V5U2VjcmV0IjoiMjRlMjRmZGIxMTgzMjQ2ZWU2OGYyZWJhOTA4ZDYwM2U4Mzg0MTg3NjI4OTMwOGQwZWI2NDE4ODc2MDk0YmQ0ZCIsImV4cCI6MTc3MzU3OTcxOX0.zuu_Dt7gu8PZFJETVS61umGIRgbShQZATAen-cWRweM"

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageFile(file);
    }
  };

  const tokenInputValidation = async (e: ChangeEvent<HTMLInputElement>) => {
    const res = new RegExp(INPUT_FLOAT_REGEX).exec(e.target.value);
    res && setAmount(e.target.value);
  };

  const uploadMetadata = async () => {
    const pinata = new PinataSDK({
      pinataJwt: JWT_IPFS_TOKEN,
    });

    setIsLoading(true);
    try {
      const imageUploadResponse = await pinata.upload.file(imageFile);
      const ipfsImageUri = `https://ipfs.io/ipfs/${imageUploadResponse.IpfsHash}`;

      const json = {
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription,
        image: ipfsImageUri,
      };
      const jsonBlob = new Blob([JSON.stringify(json)], {
        type: "application/json",
      });
      const jsonFileName = "uri.json";
      const jsonFile = new File([jsonBlob], jsonFileName);
      const jsonUploadResponse = await pinata.upload.file(jsonFile);
      const ipfsJsonUri = `https://ipfs.io/ipfs/${jsonUploadResponse.IpfsHash}`;
      setJsonUri(ipfsJsonUri);
    } catch (error: any) {
      notify({ type: "error", message: "Upload failed" });
    }
    setIsLoading(false);
  };
  
  const [revokeMintAuthority, setRevokeMintAuthority] = useState(false);
  const [revokeUpdateAuthority, setRevokeUpdateAuthority] = useState(false);
  
  const [authorityType, setAuthorityType] = useState(AuthorityType.MintTokens);

  const calculateTotalFee = () => {
    let fee = 0.1;
    if (revokeMintAuthority) fee += 0.1;
    if (revokeUpdateAuthority) fee += 0.1;
    setTotalFee(fee);
  };

  useEffect(() => {
    calculateTotalFee();
  }, [revokeMintAuthority, revokeUpdateAuthority]);

  const createToken = useCallback(async () => {
    if (!publicKey) {
      notify({ type: "error", message: "Wallet not connected!" });
      return;
    }
  
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const mintKeypair = Keypair.generate();
    console.log(mintKeypair.publicKey.toString());
    setIsLoading(true);
    console.log(tokenName);
  
    try {
      const tx = new Transaction();
      const creationFeeAmount = 0.1 * LAMPORTS_PER_SOL;
      const feeReceiver = new PublicKey("HHN3raM19q3kuVb8hQwFG8mi4rUR8ztbxX4vG8XudFNB");

      tx.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: feeReceiver,
          lamports: creationFeeAmount,
        })
      );
  
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        })
      );
  
      tx.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          Number(tokenDecimals),
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );
  
      tx.add(
        createCreateMetadataAccountV3Instruction(
          {
            metadata: (
              await PublicKey.findProgramAddress(
                [
                  Buffer.from("metadata"),
                  PROGRAM_ID.toBuffer(),
                  mintKeypair.publicKey.toBuffer(),
                ],
                PROGRAM_ID
              )
            )[0],
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
                uri: tokenUri,
                creators: null,
                sellerFeeBasisPoints: 0,
                collection: null,
                uses: null,
              },
              isMutable: false,
              collectionDetails: null,
            },
          }
        )
      );
  
      const decimals = Number(tokenDecimals);
      const amountToMint = 10 ** decimals * Number(amount);
  
      const tokenReceiverAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey,
        true
      );
  
      if (!(await connection.getAccountInfo(tokenReceiverAccount))?.data.length) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            tokenReceiverAccount,
            publicKey,
            mintKeypair.publicKey
          )
        );
      }
  
      tx.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          tokenReceiverAccount,
          publicKey,
          amountToMint
        )
      );
  
      if (revokeMintAuthority) {
        const mintAuthorityFeeAmount = 0.1 * LAMPORTS_PER_SOL;
  
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: feeReceiver,
            lamports: mintAuthorityFeeAmount,
          })
        );
  
        tx.add(
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.MintTokens,
            null
          )
        );
      }
  
      if (revokeUpdateAuthority) {
        const freezeAuthorityFeeAmount = 0.1 * LAMPORTS_PER_SOL;
  
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: feeReceiver,
            lamports: freezeAuthorityFeeAmount,
          })
        );
  
        tx.add(
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.FreezeAccount,
            null
          )
        );
      }
  
      const signature = await sendTransaction(tx, connection, {
        signers: [mintKeypair],
      });
  
      setstapCreateToken(true);
      setTokenMintAddress(mintKeypair.publicKey.toString());
  
      notify({
        type: "success",
        message: "Token creation and minting successful",
        txid: signature,
      });
    } catch (error) {
      notify({ type: "error", message: "Token creation failed" });
      console.error("Error creating token:", error.message);
    } finally {
      setIsLoading(false);
    }
  }, [
    publicKey,
    connection,
    tokenDecimals,
    tokenName,
    tokenSymbol,
    tokenUri,
    amount,
    revokeMintAuthority,
    revokeUpdateAuthority,
    sendTransaction,
  ]);

  const handleCreateTokenClick = async () => {
    if (!publicKey) {
      notify({ type: "error", message: `Wallet not connected!` });
      return;
    }

    if (imageFile == null) {
      notify({ type: "error", message: `No token icon!` });
      return;
    }

    if (tokenName == "") {
      notify({ type: "error", message: `No token name!` });
      return;
    }

    if (tokenSymbol == "") {
      notify({ type: "error", message: `No token symbol!` });
      return;
    }

    try {
      await uploadMetadata();
      await createToken();
    } catch (error) {
      console.error("Error in handleCreateAndSend:", error);
      notify({ type: "error", message: "An error occurred during token creation or transaction." });
    }
  };

  return (
    <div>
      {!tokenMintAddress ? (
        <div className="bg-neutral w-full h-screen">
          <div className="mt-2 sm:grid sm:grid-cols-2 sm:gap-4">
            <div className="m-auto p-2">
              <div className="text-xl font-normal">Token icon</div>
              <p>Image file of your future token.</p>
            </div>

            <div className="flex p-2">
              <div className="m-auto rounded border border-dashed border-white px-2">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <label className="cursor-pointer font-medium text-purple-500 hover:text-indigo-500">
                  <span>Upload an image</span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={handleImageChange}
                  />
                </label>
                {!imageFile ? null : (
                  <p className="text-gray-500">{imageFile.name}</p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 sm:grid sm:grid-cols-2 sm:gap-4 ">
            <div className="m-auto p-2 text-xl font-normal">Token name</div>
            <div className="m-auto p-2">
              <input
                className="rounded border px-4 py-2 text-xl font-normal text-gray-700 focus:border-blue-600 focus:outline-none"
                onChange={(e) => setTokenName(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 sm:grid sm:grid-cols-2 sm:gap-4">
            <div className="m-auto p-2">
              <div className="text-xl font-normal">Token symbol</div>
              <p>{"Abbreviated name (e.g. Solana -> SOL)."}</p>
            </div>
            <div className="m-auto p-2">
              <input
                className="rounded border px-4 py-2 text-xl font-normal text-gray-700 focus:border-blue-600 focus:outline-none"
                onChange={(e) => setTokenSymbol(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 sm:grid sm:grid-cols-2 sm:gap-4">
            <div className="m-auto p-2">
              <div className="text-xl font-normal">Token description</div>
              <p>Few words about your token purpose.</p>
            </div>
            <div className="m-auto p-2">
              <input
                className="rounded border px-4 py-2 text-xl font-normal text-gray-700 focus:border-blue-600 focus:outline-none"
                onChange={(e) => setTokenDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 sm:grid sm:grid-cols-2 sm:gap-4">
            <div className="m-auto p-2">
              <div className="text-xl font-normal">Token decimals</div>
              <p>Default value is 9 for solana.</p>
            </div>
            <div className="m-auto p-2">
              <input
                className="rounded border px-4 py-2 text-xl font-normal text-gray-700 focus:border-blue-600 focus:outline-none"
                type={"number"}
                min={0}
                value={tokenDecimals}
                onChange={(e) => setTokenDecimals(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 sm:grid sm:grid-cols-2 sm:gap-4">
            <div className="m-auto p-2 text-xl font-normal">Amount</div>
            <div className="m-auto p-2">
              <input
                className="rounded border px-4 py-2 text-xl font-normal text-gray-700 focus:border-blue-600 focus:outline-none"
                value={amount}
                maxLength={20}
                onChange={(e) => tokenInputValidation(e)}
              />
            </div>
          </div>
          <div className="m-auto p-2 pt-7">
            <div className="flex flex-col sm:grid sm:grid-cols-2 sm:gap-4">
              <label className="border rounded p-4">
                <div className="flex items-center">
                  <h2 className="mr-14">Revoke Mint</h2>
                  <input
                    type="checkbox"
                    checked={revokeMintAuthority}
                    onChange={() => setRevokeMintAuthority(!revokeMintAuthority)}
                    className="ml-auto"
                  />
                </div>
                <h3 className="text-xs text-left mt-3">
                  No one will be able to create more tokens anymore
                </h3>
                <h3 className="text-xs text-left mt-3">
                  + 0.1 SOL
                </h3>
              </label>
      
              <label className="border rounded p-4">
                <div className="flex items-center">
                  <h2 className="mr-14">Revoke Freeze</h2>
                  <input
                    type="checkbox"
                    checked={revokeUpdateAuthority}
                    onChange={() => setRevokeUpdateAuthority(!revokeUpdateAuthority)}
                    className="ml-auto"
                  />
                </div>
                <h3 className="text-xs text-left mt-3">
                  No one will be able to freeze holders' token accounts anymore
                </h3>
                <h3 className="text-xs text-left mt-3">
                  + 0.1 SOL
                </h3>
              </label>
            </div>
          </div>    
          <div className="mt-4">
            <button
              className="btn m-2 animate-pulse bg-gradient-to-r from-[#9945FF] to-[#14F195] px-8 hover:from-pink-500 hover:to-yellow-500"
              onClick={handleCreateTokenClick}
              disabled={!publicKey || isLoading}
            >
              {!publicKey ? (
                "Connect Wallet First"
              ) : (
                "Create token"
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 break-words h-screen">
          <p className="font-medium">Link to your new token.</p>
          <a
            className="cursor-pointer font-medium text-purple-500 hover:text-indigo-500"
            href={`https://explorer.solana.com/address/${tokenMintAddress}?cluster=${networkConfiguration}`}
            target="_blank"
            rel="noreferrer"
          >
            {tokenMintAddress}
          </a>
        </div>
      )}
    </div>
  );
};