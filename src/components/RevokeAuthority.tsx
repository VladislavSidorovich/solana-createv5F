import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionSignature, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { FC, useCallback, useState, useEffect } from "react";
import { notify } from "../utils/notifications";
import {
  AuthorityType,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
import { ClipLoader } from "react-spinners";

// Constants
const FEE_RECEIVER = new PublicKey("3ZKbQYyoHDne2k3486sSsZXt7kxjPSxkUcvx8LuLcRnE");
const AUTHORITY_FEE_LAMPORTS = 0.1 * LAMPORTS_PER_SOL;

export const RevokeAuthority: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [tokenMintAddress, setTokenMintAddress] = useState("");
  const [authorityType, setAuthorityType] = useState(AuthorityType.MintTokens);
  const [isLoading, setIsLoading] = useState(false);
  const [totalFee, setTotalFee] = useState(AUTHORITY_FEE_LAMPORTS / LAMPORTS_PER_SOL);

  // Calculate total fee whenever authority type changes
  useEffect(() => {
    setTotalFee(AUTHORITY_FEE_LAMPORTS / LAMPORTS_PER_SOL);
  }, [authorityType]);

  const onClick = useCallback(async () => {
    if (!publicKey) {
      notify({ type: "error", message: `Wallet not connected!` });
      console.log("error", `Send Transaction: Wallet not connected!`);
      return;
    }

    if (!tokenMintAddress) {
      notify({ type: "error", message: `Token mint address is required!` });
      return;
    }

    let signature: TransactionSignature = "";
    const transaction = new Transaction();
    setIsLoading(true);

    try {
      const tokenMintPubkey = new PublicKey(tokenMintAddress);

      // Add fee payment
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: FEE_RECEIVER,
          lamports: AUTHORITY_FEE_LAMPORTS,
        })
      );

      // Add authority revocation
      transaction.add(
        createSetAuthorityInstruction(
          tokenMintPubkey,
          publicKey,
          authorityType,
          null,
        ),
      );

      signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      notify({
        type: "success",
        message: "Authority revoked successfully!",
        txid: signature,
      });
    } catch (error: any) {
      notify({
        type: "error",
        message: `Transaction failed!`,
        description: error?.message,
        txid: signature,
      });
      console.log("error", `Transaction failed! ${error?.message}`, signature);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, tokenMintAddress, authorityType, sendTransaction, connection]);

  return (
    <div className="max-w-4xl mx-auto p-4 ">
      <h1 className="text-3xl font-bold mb-6">Revoke Token Authority</h1>
      
      <div className="space-y-6">
        {/* Token Mint Address */}
        <div>
          <label className="block mb-2 font-medium">Token Mint Address*</label>
          <input
            className="w-full p-3 text-gray-700 border rounded-lg"
            value={tokenMintAddress}
            onChange={(e) => setTokenMintAddress(e.target.value)}
            placeholder="Enter token mint address"
          />
        </div>

        {/* Authority Type */}
        <div>
          <label className="block mb-2 font-medium">Authority Type*</label>
          <select
            className="select-bordered select text-xl font-normal"
            value={authorityType}
            onChange={(e) =>
              setAuthorityType(Number(e.target.value) as AuthorityType)
            }
          >
            <option value={AuthorityType.MintTokens}>Mint Authority (Can mint new tokens)</option>
            <option value={AuthorityType.FreezeAccount}>Freeze Authority (Can freeze token accounts)</option>
          </select>
        </div>

        {/* Fee Summary */}
        <div className="p-4 bg-transparent rounded-lg border">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">Total Fee</h3>
              <p className="text-sm text-gray-600">
                Fee for revoking authority
              </p>
            </div>
            <div className="text-2xl font-bold">{totalFee} SOL</div>
          </div>
        </div>

        {/* Revoke Button */}
        <button
          onClick={onClick}
          disabled={isLoading || !publicKey || !tokenMintAddress}
          className="w-full py-3 px-6 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <ClipLoader size={20} color="#fff" className="mr-2" />
              Revoking Authority...
            </span>
          ) : !publicKey ? (
            "Connect Wallet to Continue"
          ) : (
            "Revoke Authority"
          )}
        </button>

        {/* Warning Message */}
        <div className="p-4 bg-transparent border border-gray-600 rounded-lg">
          <h3 className="font-medium text-gray-600">Important Notice</h3>
          <p className="text-sm text-gray-600 mt-1">
            Revoking authority is irreversible. Once revoked, this action cannot be undone.
            Make sure you want to proceed before confirming the transaction.
          </p>
        </div>
      </div>
    </div>
  );
};