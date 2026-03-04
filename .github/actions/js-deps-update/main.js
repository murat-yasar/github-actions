const core = require('@actions/core');
const exec = require('@actions/exec');      // To execute CLI scripts
const github = require('@actions/github');  // To connect oktokit-API

/*
[X] 1. Parse Inputs
      1.1 base-branch from which to check for updates
      1.2 head-branch to use to create the PR
      1.3 Github Token for authentication purposes (to create PRs)
      1.4 Working directory for which to check for dependencies
[X] 2. Execute the 'npm update' command within the working directory
[X] 3. Check whether there are modified package*.json files
[X] 4. If there are modified files:
      4.1 Add and commit files to the head branch
      4.2 Create a PR to the base-branch using the octokit API (GitHub API)
[X] 5. Otherwise, conclude the custom action
*/

const setupGit = async () => {
  //TODO: Replace "gh-automation" with a repo-secret
  await exec.exec(`git config --global user.name "gh-automation"`);
  //TODO: Replace "gh-automation@mail.com" with a repo-secret
  await exec.exec(`git config --global user.email "gh-automation@mail.com"`);
}

const setupLogger = ({ debug, prefix } = { debug: false, prefix: '' }) => ({
  debug: (message) => {
    if (debug){ core.info(`DEBUG ${prefix}${prefix ? ' : ' : ''}${message}`); }
  },
  info: (message) => {
    core.info(`${prefix}${prefix ? ' : ' : ''}${message}`);
  },
  error: (message) => {
    core.error(`${prefix}${prefix ? ' : ' : ''}${message}`);
  },
});

// 1. Parse Inputs
// Branch-name validation for security
const validateBranchName = ({branchName}) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({directoryName}) => /^[a-zA-Z0-9_\-\.\/]+$/.test(directoryName);

async function run () {
  // The values should match with the action.yaml file!
  const baseBranch = core.getInput('base-branch', {required: true}) || 'default-value';
  const headBranch = core.getInput('head-branch', {required: true});
  const ghToken = core.getInput('gh-token', {required: true});
  const workingDir = core.getInput('working-directory', {required: true});
  const debug = core.getBooleanInput('debug');
  const logger = setupLogger({ debug, prefix: '[js-deps-update]'});

  // Set common exec options
  const commonExecOpts = {
    cwd: workingDir   // cwd: current working directory
  }

  // github-token should be set as secret for the security!
  core.setSecret(ghToken);

  logger.debug('Validating inputs: base-branch, head-branch, working-directory');

  if (!validateBranchName({branchName: baseBranch})) {
    core.setFailed('Invalid base branch name! Branch names should include only characters, numbers, hypens, underscores, dots, and forward slashes...');
    return;
  }

  if (!validateBranchName({branchName: headBranch})) {
    core.setFailed('Invalid head branch name! Branch names should include only characters, numbers, hypens, underscores, dots, and forward slashes...');
    return;
  }

  if (!validateDirectoryName({branchName: workingDir})) {
    core.setFailed('Invalid working directory name! directory names should include only characters, numbers, hypens, underscores, and forward slashes...');
    return;
  }

  logger.debug(`Base branch is {baseBranch}`);
  logger.debug(`Head branch is {headBranch}`);
  logger.debug(`Working directory is {workingDir}`);

  logger.debug(`Checking for package updates`);

  // 2. Execute the 'npm update' command within the working directory
  await exec.exec('npm update', [], {
    ...commonExecOpts
  });

  const gitStatus = await exec.getExecOutput('git status -s package*.json', [], {
    ...commonExecOpts
  });

  let updatesAvailable = false;

  // 3. If the output of 'git status ...' command is zero, then there is no update
  if (gitStatus.stdout.length > 0) {
    updatesAvailable = true;

    logger.debug(`There are updates available!`);
    logger.debug(`Setting up git...`);

    // 4.1 Add and commit files to the head branch
    await setupGit();

    logger.debug(`Commiting and pushing package*.json changes...`);
    await exec.exec(`git checkout -b ${headBranch}`, [], {
      ...commonExecOpts
    });
    await exec.exec(`git add package-lock.json`, [], {
      ...commonExecOpts
    });
    await exec.exec(`git commit -m "chor: update dependencies"`, [], {
      ...commonExecOpts
    });
    //TODO: It's better to rebase first, and then to push, if everything goes well
    await exec.exec(`git push -u origin ${headBranch} --force`, [], {
      ...commonExecOpts
    });

    // 4.2 Create a PR
    logger.debug(`Fetching octokit API...`)
    const octokit = github.getOctokit(ghToken);

    try {
      logger.debug(`Creating PR using head branch: ${headBranch}`);
			await octokit.rest.pulls.create({
				owner: github.context.repo.owner,
				repo: github.context.repo.repo,
				title: "Update NPM Dependencies",
				body: "This PR updates NPM packages",
				base: baseBranch,
				head: headBranch,
			});
		} catch (e) {
      logger.error(`Something went wrong while creating the PR! Check the logs below:`);
      core.setFailed(e.message)
      logger.error(e);
    }

  } else {
    // 5. Conclude the custom action
    logger.info(`There is no updates at the moment!`);
  }

  logger.debug(`Setting updates-available output to ${updatesAvailable}...`);
  core.setOutput(`updates-available`, updatesAvailable);
}

run();