import { BrowserProvider, Contract } from "ethers";
import contractAddresses from "./contractAddresses.json";

export async function getProvider() {
  if (!window.ethereum) return null;
  return new BrowserProvider(window.ethereum);
}

export async function getReadOnlyContract(abi, contractName) {
  const provider = await getProvider();
  if (!provider || !contractAddresses.contracts?.[contractName]) return null;
  return new Contract(contractAddresses.contracts[contractName], abi, provider);
}

export function getContractAddress(contractName) {
  return contractAddresses.contracts?.[contractName] || null;
}
