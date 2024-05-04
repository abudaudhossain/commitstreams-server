const logger = require('../../libraries/log/logger');

const Model = require('./schema');
const User = require('../user/schema');
const { AppError } = require('../../libraries/error-handling/AppError');

const { fetchRepoDetails } = require('../../libraries/util/githubUtils');
const { decryptToken } = require('../../auth');

const model = 'repository';

const create = async (data) => {
  try {
    const item = new Model(data);
    const saved = await item.save();
    logger.info(`create(): ${model} created`, {
      id: saved._id,
    });
    return saved;
  } catch (error) {
    logger.error(`create(): Failed to create ${model}`, error);
    throw new AppError(`Failed to create ${model}`, error.message);
  }
};

const search = async (searchPayload) => {
  try {
    const { username, repository } = searchPayload ?? {};

    // if username or repository is not provided, throw an error
    if (!username || !repository) {
      throw new AppError('Username and Repository are required', 'Bad Request', 400);
    }

    let filter = {};
    if (username && repository) {
      filter = {
        full_name: `${username}/${repository}`,
      }
    }
    const item = await Model.findOne(filter).exec();
    logger.info('search(): filter and count', {
      filter,
      count: Boolean(item) ? 1 : 0,
    });
    return item;
  } catch (error) {
    logger.error(`search(): Failed to search ${model}`, error);
    throw new AppError(`Failed to search ${model}`, error.message, 400);
  }
};

const getById = async (id) => {
  try {
    const item = await Model.findById(id);
    logger.info(`getById(): ${model} fetched`, { id, _id: item._id });
    return item;
  } catch (error) {
    logger.error(`getById(): Failed to get ${model}`, error);
    throw new AppError(`Failed to get ${model}`, error.message);
  }
};

const updateById = async (id, data) => {
  try {
    const item = await Model.findByIdAndUpdate(id, data, { new: true });
    logger.info(`updateById(): ${model} updated`, { id });
    return item;
  } catch (error) {
    logger.error(`updateById(): Failed to update ${model}`, error);
    throw new AppError(`Failed to update ${model}`, error.message);
  }
};

const deleteById = async (id) => {
  try {
    await Model.findByIdAndDelete(id);
    logger.info(`deleteById(): ${model} deleted`, { id });
    return true;
  } catch (error) {
    logger.error(`deleteById(): Failed to delete ${model}`, error);
    throw new AppError(`Failed to delete ${model}`, error.message);
  }
};

const mapGithubResponseToSchema = (response) => {
  return {
    id: response.id,
    node_id: response.node_id,
    name: response.name,
    full_name: response.full_name,
    private: response.private,
    owner: {
      login: response.owner.login,
      id: response.owner.id,
      avatar_url: response.owner.avatar_url,
      type: response.owner.type,
    },
    html_url: response.html_url,
    description: response.description,
    fork: response.fork,
    url: response.url,
    created_at: new Date(response.created_at),
    updated_at: new Date(response.updated_at),
    pushed_at: new Date(response.pushed_at),    
    homepage: response.homepage,
    size: response.size,
    stargazers_count: response.stargazers_count,
    watchers_count: response.watchers_count,
    language: response.language,
    languages: response.languages,
    forks_count: response.forks_count,
    archived: response.archived,
    disabled: response.disabled,
    open_issues_count: response.open_issues_count,
    license: {
      key: response.license.key,
      name: response.license.name,
      spdx_id: response.license.spdx_id,
      url: response.license.url,
      node_id: response.license.node_id,
    },    
    topics: response.topics,
    visibility: response.visibility,
    default_branch: response.default_branch,
  };
};

const mapSelectedGithubResponseToSchema = (response) => {
  return {
    description: response.description,
    updated_at: new Date(response.updated_at),
    pushed_at: new Date(response.pushed_at),
    homepage: response.homepage,
    size: response.size,
    stargazers_count: response.stargazers_count,
    watchers_count: response.watchers_count,
    language: response.language,
    languages: response.languages,
    forks_count: response.forks_count,
    archived: response.archived,
    disabled: response.disabled,
    open_issues_count: response.open_issues_count,
    topics: response.topics,
  };
};

const fetchGitHubRepoDetails = async (owner, repo, user) => {
  // get user access token and access token IV from database
  // decrypt access token and access token IV
  // fetch repository details from GitHub using the decrypted access token
  // map the GitHub response to schema
  // create the repository in database
  // return the repository object
  try {
    const { _id } = user;
    const dbUser = await User.findById(_id).exec();
    const { accessToken, accessTokenIV } = dbUser;
    const token = decryptToken(accessToken, accessTokenIV);
    console.log('token:', { owner, repo, token });

    const response = await fetchRepoDetails(owner, repo, token);
    console.log('response', response);
    // check if the repository already exists in the database by id node_id
    // if it exists, update the repository details using mapSelectedGithubResponseToSchema
    // else create the repository using mapGithubResponseToSchema
    const { id } = response;
    const existingRepository = await Model
      .findOne({ id })
      .exec();
    if (existingRepository) {
      const data = mapSelectedGithubResponseToSchema(response);
      const updatedRepository = await updateById(existingRepository._id, data);
      return updatedRepository;
    }
    const data = mapGithubResponseToSchema(response);
    console.log('data:', data);
    const repository = await create(data);
    return repository;
  } catch (error) {
    logger.error(
      'fetchGitHubRepoDetails(): Failed to fetch repository details',
      error
    );
    throw new AppError('Failed to fetch repository details', error.message);
  }
};

module.exports = {
  create,
  search,
  getById,
  updateById,
  deleteById,
  fetchGitHubRepoDetails,
};
