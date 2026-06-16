module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [1, 'always', ['contracts', 'api', 'web', 'infra', 'docs', 'ci', 'repo', 'deps']],
  },
};
