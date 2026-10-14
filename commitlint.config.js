/** 仅校验 Conventional Commits 的类型和描述，不限制大小写、类型列表或长度。 */
export default {
  parserPreset: 'conventional-changelog-conventionalcommits',
  rules: {
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'header-trim': [2, 'always'],
  },
};
