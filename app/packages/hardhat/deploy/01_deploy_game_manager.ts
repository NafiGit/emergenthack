import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the GameManager contract using the deployer account
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployGameManager: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer } = await hre.getNamedAccounts();
    const { deploy } = hre.deployments;

    await deploy("GameManager", {
        from: deployer,
        // Contract constructor arguments (none for GameManager)
        args: [],
        log: true,
        // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
        // automatically mining the contract deployment transaction. There is no effect on live networks.
        autoMine: true,
    });

    // Get the deployed contract to interact with it after deploying.
    const gameManager = await hre.ethers.getContract<Contract>("GameManager", deployer);
    console.log("👋 GameManager deployed at:", await gameManager.getAddress());
    console.log("📊 Entry Fee:", await gameManager.ENTRY_FEE(), "MON (0.1 MON)");
    console.log("👥 Player Range:", await gameManager.MIN_PLAYERS(), "-", await gameManager.MAX_PLAYERS());
};

export default deployGameManager;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags GameManager
deployGameManager.tags = ["GameManager"];
