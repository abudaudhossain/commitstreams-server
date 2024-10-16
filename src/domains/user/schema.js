const mongoose = require('mongoose');
const { baseSchema } = require('../../libraries/db/base-schema');

const schema = new mongoose.Schema({
  // id
  githubId: {
    type: String,
    required: false,
  },
  nodeId: {
    type: String,
    required: false,
  },
  displayName: {
    type: String,
    required: false,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  profileUrl: {
    type: String,
    required: false,
  },
  password: {
    type: String,
    required: false,
  },

  /* _json */
  avatarUrl: {
    type: String,
  },
  apiUrl: {
    type: String,
    required: false,
  },
  company: {
    type: String,
  },
  blog: {
    type: String,
  },
  location: {
    type: String,
  },
  email: {
    type: String,
  },
  hireable: {
    type: Boolean,
  },
  bio: {
    type: String,
  },
  public_repos: {
    type: Number,
  },
  public_gists: {
    type: Number,
  },
  followers: { type: Number },
  following: { type: Number },
  created_at: { type: Date },
  updated_at: { type: Date },

  // auth
  accessToken: {
    type: String,
  },
  accessTokenIV: {
    type: String,
  },
  isDemo: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isDeactivated: {
    type: Boolean,
    default: false,
  },

  // commitstreams related similar properties
  csFollowers: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId },
      date: { type: Date, default: Date.now },
    },
  ],
  csFollowing: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId },
      date: { type: Date, default: Date.now },
    },
  ],
  csFollowingRepositories: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId },
      date: { type: Date, default: Date.now },
    },
  ],
});

schema.add(baseSchema);

module.exports = mongoose.model('User', schema);
