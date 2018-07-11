let baseDefinition = `
  id: ID!
  status: RoundSubmissionStatus!
  round: Round!
  participant: User
  song: Song!
  file: File
`;

exports.schema = `
  interface Roundsubmission {
    ${baseDefinition}
  }
  type AdministeredRoundsubmission implements Roundsubmission {
    ${baseDefinition}
  }
  type ParticipatedRoundsubmission implements Roundsubmission {
    ${baseDefinition}
    uploadUrl: String!
  }
  type ObservedRoundsubmission implements Roundsubmission {
    ${baseDefinition}
  }
  enum RoundSubmissionStatus {
    Planned,
    Started,
    FillInRequested,
    FillInAquired,
    Submitted,
    Completed,
    Skipped 
  }
`;