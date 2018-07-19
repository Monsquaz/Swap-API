import { schemaHelper } from '../../util';
const { createRootQuery, createSelection } = schemaHelper;

exports.query = `
  ${[
    'event',
    'file',
    'roundsubmission',
    'song',
    'user'
  ].map(createRootQuery).join('\n')}`;

exports.schema = `
  ${createSelection({
    type: 'event',
    sortFields: ['id'],
    numericFields: [
      ['id', 'Int']
    ]
  })}
  ${createSelection({
    type: 'file',
    sortFields: ['id'],
    numericFields: [
      ['id', 'Int']
    ]
  })}
  ${createSelection({
    type: 'roundsubmission',
    sortFields: ['id'],
    numericFields: [
      ['id', 'Int']
    ]
  })}
  ${createSelection({
    type: 'song',
    sortFields: ['id'],
    numericFields: [
      ['id', 'Int']
    ]
  })}
  ${createSelection({
    type: 'user',
    sortFields: ['id'],
    numericFields: [
      ['id', 'Int']
    ]
  })}
`;
