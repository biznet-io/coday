echo "Init repo"
git config --global user.email "${GITLAB_CI_USER_EMAIL}"
git config --global user.name "${GITLAB_CI_USER_NAME}"
git config --global init.defaultBranch "${CI_COMMIT_REF_NAME}"
export GIT_DISCOVERY_ACROSS_FILESYSTEM=true

if [ -f "$WORKING_DIRECTORY/$INIT_REPOSITORY_PIPELINE_ID_ENV_FILE" ]; then
  source $WORKING_DIRECTORY/$INIT_REPOSITORY_PIPELINE_ID_ENV_FILE
  if [ $INIT_REPOSITORY_PIPELINE_ID == $CI_PIPELINE_ID ]; then
    echo "Job has been manually re-run, removing repository cache"
    cd $WORKING_DIRECTORY/..
    rm -Rf $WORKING_DIRECTORY/
    mkdir -p $WORKING_DIRECTORY
    cd $WORKING_DIRECTORY
  else
    echo "Job has been automatically executed, keeping repository cache"
  fi
else
  echo "No init repository pipeline id variable found"
fi

if [ "$(git remote | grep origin)" != "origin" ]; then
  echo 'repository cache is empty, initializing it...'
  git clone "git@gitlab.com:biznet.io/coday.git" -b "${CI_COMMIT_REF_NAME}" .
  git config merge.directoryRenames false
  git fetch --tags --force
else
  echo 'repository cache is already present, updating sources...'
  git fetch --tags --force
  git reset --hard origin/$CI_COMMIT_REF_NAME
fi

echo "INIT_REPOSITORY_PIPELINE_ID=$CI_PIPELINE_ID" > $WORKING_DIRECTORY/$INIT_REPOSITORY_PIPELINE_ID_ENV_FILE

### Merge request pipelines run on the contents of the source branch only, ignoring the content of the target branch.
### To run a pipeline that tests the result of merging the source and target branches together, use merged results pipelines.
### This is the Gitlab configuration, but as we are using a branch cache that is taking care of pulling the repository the Gitlab machinery for this is not working.
### Thus we reproduce the same behaviour on our own. If there are any conflicts the pipeline will fail until conflicts are resolved.
if [ $CI_MERGE_REQUEST_TARGET_BRANCH_NAME ]; then
  sh $WORKING_DIRECTORY/.github/actions/init/init-merge-result-pipeline.sh
fi

### Never init cache for tag pipelines that are only triggered to promote a rc tag to a release tag
if [ -z "$CI_COMMIT_TAG" ]; then
  sh $WORKING_DIRECTORY/.github/actions/init/init-cache.sh
fi
