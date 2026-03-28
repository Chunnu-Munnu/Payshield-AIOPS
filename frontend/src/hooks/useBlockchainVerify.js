import { useEffect, useState } from "react";
import { verifyBlockchain } from "../services/api";

export default function useBlockchainVerify(txHash) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!txHash) return;
    verifyBlockchain(txHash).then(setResult).catch(() => setResult({ verified: false }));
  }, [txHash]);

  return result;
}
