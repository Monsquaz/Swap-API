import { schemaHelper } from '../../util';
const { createRootQuery, createSelection } = schemaHelper;

exports.query = `
  currentUser: User
  ${[
    'event','file','roundsubmission','song','user'
  ].map(createRootQuery).join('\n')}`;

exports.schema = `
  ${createSelection({
    type: 'event',
    sortFields: [
      'id',
      'name',
      'status',
      'numParticipants',
      'numRounds',
      'isPublic',
      'isScheduleVisible',
      'areChangesVisible',
      'hostUserId'
    ],
    directFields: {
      slug: 'String',
      status: '[EventStatus!]',
      isParticipating: 'Boolean',
      isPublic: 'Boolean',
      hostUserId: 'Int'
    },
    numericFields: [
      ['id', 'Int'],
      ['created', 'String'],
      ['started', 'String'],
      ['completed', 'String']
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
    sortFields: ['id','songId','roundId'],
    directFields: {
      'songId': 'ID',
      'roundId': 'ID'
    },
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
    sortFields: ['id', 'username'],
    directFields: {
      id: '[ID!]',
      slug: 'String'
    },
    numericFields: [
      ['id', 'Int']
    ]
  })}
`;
