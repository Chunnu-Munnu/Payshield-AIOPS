const fs = require("fs")
const path = require("path")
const hre = require("hardhat")

async function main() {
  const ObservabilityLedger = await hre.ethers.getContractFactory("ObservabilityLedger")
  const ledger = await ObservabilityLedger.deploy()
  await ledger.waitForDeployment()

  const outputDir = path.join(__dirname, "..", "deployments")
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(
    path.join(outputDir, "observability_address.json"),
    JSON.stringify(
      {
        address: await ledger.getAddress(),
        deployedAt: new Date().toISOString(),
        network: hre.network.name,
      },
      null,
      2
    )
  )

  console.log(`ObservabilityLedger deployed to ${await ledger.getAddress()}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
