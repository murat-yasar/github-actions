const core = require('@actions/core');
const exec = require('@actions/exec');      // To execute CLI scripts
const github = require('@actions/github');  // To connect oktokit-API

/*
[X] 1. Parse Inputs
      1.1 base-branch from which to check for updates
      1.2 target-branch to use to create the PR
      1.3 Github Token for authentication purposes (to create PRs)
      1.4 Working directory for which to check for dependencies
[X] 2. Execute the 'npm update' command within the working directory
[X] 3. Check whether there are modified package*.json files
[X] 4. If there are modified files:
      4.1 Add and commit files to the target branch
      4.2 Create a PR to the base-branch using the octokit API (GitHub API)
[X] 5. Otherwise, conclude the custom action
*/

// 1. Parse Inputs
// Branch-name validation for security
const validateBranchName = ({branchName}) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({directoryName}) => /^[a-zA-Z0-9_\-\.\/]+$/.test(directoryName);

async function run () {
  // The values should match with the action.yaml file!
  const baseBranch = core.getInput('base-branch', {required: true}) || 'default-value';
  const targetBranch = core.getInput('target-branch', {required: true});
  const ghToken = core.getInput('gh-token', {required: true});
  const workingDir = core.getInput('working-directory', {required: true});
  const debug = core.getBooleanInput('debug');

  // Set common exec options
  const commonExecOpts = {
    cwd: workingDir   // cwd: current working directory
  }

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
    ...commonExecOpts
  });

  const gitStatus = await exec.getExecOutput('git status -s package*.json', [], {
    ...commonExecOpts
  });

  // If the output of 'git status ...' command is zero, then there is no update
  if (gitStatus.stdout.length > 0) {
    core.info(`[js-deps-update]: There are updates available!`);
    //TODO: Replace "gh-automation" with a repo-secret
    await exec.exec(`git config --global user.name "gh-automation"`);
    //TODO: Replace "gh-automation@mail.com" with a repo-secret
    await exec.exec(`git config --global user.email "gh-automation@mail.com"`);
    await exec.exec(`git checkout -b ${targetBranch}`, [], {
      ...commonExecOpts
    });
    await exec.exec(`git add package-lock.json`, [], {
      ...commonExecOpts
    });
    await exec.exec(`git commit -m "chor: update dependencies"`, [], {
      ...commonExecOpts
    });
    //TODO: It's better to rebase first, and then to push, if everything goes well
    await exec.exec(`git push -u origin ${targetBranch} --force`, [], {
      ...commonExecOpts
    });

    const octokit = github.getOctokit(ghToken);
    try {
			// Create a PR
			await octokit.rest.pulls.create({
				owner: github.context.repo.owner,
				repo: github.context.repo.repo,
				title: "Update NPM Dependencies",
				body: "This PR updates NPM packages",
				base: baseBranch,
				head: targetBranch,
			});
		} catch (e) {
      core.error(`[js-deps-update]: Something went wrong while creating the PR! Check the logs below:`);
      core.setFailed(e.message)
      core.error(e);
    }
  } else {
    core.info(`[js-deps-update]: There is no updates at the moment!`);
  }
}

run();