const core = require('@actions/core');
const exec = require('@actions/exec');  // To execute CLI scripts

/*
[X] 1. Parse Inputs
      1.1 base-branch from which to check for updates
      1.2 target-branch to use to create the PR
      1.3 Github Token for authentication purposes (to create PRs)
      1.4 Working directory for which to check for dependencies
[X] 2. Execute the 'npm update' command within the working directory
[-] 3. Check whether there are modified package*.json files
[-] 4. If there are modified files:
      4.1 Add and commit files to the target branch
      4.2 Create a PR to the base-branch using the octokit API (GitHub API)
[-] 5. Otherwise, conclude the custom action
*/

// 1. Parse Inputs
// Branch-name validation for security
const validateBranchName = ({branchName}) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({directoryName}) => /^[a-zA-Z0-9_\-\.\/]+$/.test(directoryName);

async function run () {
  // The values should match with the action.yaml file!
  const baseBranch = core.getInput('base-branch');
  const targetBranch = core.getInput('target-branch');
  const ghToken = core.getInput('gh-token');
  const workingDir = core.getInput('working-directory');
  const debug = core.getBooleanInput('debug');

  // github-token should be set as secret for the security!
  core.setSecret(ghToken);

  if (!validateBranchName({branchName: baseBranch})) {
    core.setFailed('Invalid base branch name! Branch names should include only characters, numbers, hypens, underscores, dots, and forward slashes...');
    return;
  }

  if (!validateBranchName({branchName: targetBranch})) {
    core.setFailed('Invalid target branch name! Branch names should include only characters, numbers, hypens, underscores, dots, and forward slashes...');
    return;
  }

  if (!validateDirectoryName({branchName: workingDir})) {
    core.setFailed('Invalid working directory name! directory names should include only characters, numbers, hypens, underscores, and forward slashes...');
    return;
  }

  core.info(`[js-deps-update]: base branch is ${baseBranch}`);
  core.info(`[js-deps-update]: target branch is ${targetBranch}`);
  core.info(`[js-deps-update]: working directory is ${workingDir}`);


  // 2. Execute the 'npm update' command within the working directory
  await exec.exec('npm update', [], {
    cwd: workingDir   // cwd: current working directory
  });

  const gitStatus = await exec.getExecOutput('git status -s package*.json', [], {
    cwd: workingDir
  });

  // If the output of 'git status ...' command is zero, then there is no update
  if (gitStatus.stdout.length > 0) {
    core.info(`[js-deps-update]: There are updates available!`);
  } else {
    core.info(`[js-deps-update]: There is no updates at the moment!`);
  }


  core.info("I'm a custom JS action");
}

run();