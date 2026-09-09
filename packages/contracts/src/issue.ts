import * as Schema from "effect/Schema";

import {
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  ProjectId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

export const IssueState = Schema.Literals(["open", "closed"]);
export type IssueState = typeof IssueState.Type;

export const IssueListState = Schema.Literals(["open", "closed", "all"]);
export type IssueListState = typeof IssueListState.Type;

export const IssueActor = Schema.Struct({
  login: Schema.String,
  name: Schema.optional(Schema.NullOr(Schema.String)),
  avatarUrl: Schema.optional(Schema.NullOr(Schema.String)),
});
export type IssueActor = typeof IssueActor.Type;

export const IssueLabel = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.String,
  color: Schema.optional(Schema.String),
  description: Schema.optional(Schema.NullOr(Schema.String)),
});
export type IssueLabel = typeof IssueLabel.Type;

export const IssueComment = Schema.Struct({
  id: Schema.String,
  author: Schema.NullOr(IssueActor),
  body: Schema.String,
  createdAt: IsoDateTime,
  updatedAt: Schema.optional(Schema.NullOr(IsoDateTime)),
  url: Schema.optional(Schema.String),
});
export type IssueComment = typeof IssueComment.Type;

export const IssueListItem = Schema.Struct({
  id: Schema.String,
  number: PositiveInt,
  title: Schema.String,
  state: IssueState,
  url: Schema.String,
  author: Schema.NullOr(IssueActor),
  labels: Schema.Array(IssueLabel),
  assignees: Schema.Array(IssueActor),
  commentsCount: NonNegativeInt,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  closedAt: Schema.optional(Schema.NullOr(IsoDateTime)),
  projectId: Schema.optional(ProjectId),
  repository: Schema.optional(Schema.String),
});
export type IssueListItem = typeof IssueListItem.Type;

export const IssueDetail = Schema.Struct({
  id: Schema.String,
  number: PositiveInt,
  title: Schema.String,
  state: IssueState,
  url: Schema.String,
  author: Schema.NullOr(IssueActor),
  labels: Schema.Array(IssueLabel),
  assignees: Schema.Array(IssueActor),
  commentsCount: NonNegativeInt,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  closedAt: Schema.optional(Schema.NullOr(IsoDateTime)),
  body: Schema.String,
  comments: Schema.Array(IssueComment),
  projectId: Schema.optional(ProjectId),
  repository: Schema.optional(Schema.String),
});
export type IssueDetail = typeof IssueDetail.Type;

export const IssueListInput = Schema.Struct({
  projectId: Schema.optional(ProjectId),
  state: Schema.optional(IssueListState),
  search: Schema.optional(Schema.String),
  limit: Schema.optional(PositiveInt),
});
export type IssueListInput = typeof IssueListInput.Type;

export const IssueListResult = Schema.Struct({
  issues: Schema.Array(IssueListItem),
  repository: Schema.optional(Schema.String),
});
export type IssueListResult = typeof IssueListResult.Type;

export const IssueDetailInput = Schema.Struct({
  projectId: Schema.optional(ProjectId),
  number: PositiveInt,
});
export type IssueDetailInput = typeof IssueDetailInput.Type;

export const IssueCreateInput = Schema.Struct({
  projectId: Schema.optional(ProjectId),
  title: TrimmedNonEmptyString,
  body: Schema.String,
  labels: Schema.optional(Schema.Array(Schema.String)),
  assignees: Schema.optional(Schema.Array(Schema.String)),
});
export type IssueCreateInput = typeof IssueCreateInput.Type;

export const IssueUpdateInput = Schema.Struct({
  projectId: Schema.optional(ProjectId),
  number: PositiveInt,
  state: Schema.optional(IssueState),
  title: Schema.optional(TrimmedNonEmptyString),
  body: Schema.optional(Schema.String),
});
export type IssueUpdateInput = typeof IssueUpdateInput.Type;

export const IssueCommentInput = Schema.Struct({
  projectId: Schema.optional(ProjectId),
  number: PositiveInt,
  body: TrimmedNonEmptyString,
});
export type IssueCommentInput = typeof IssueCommentInput.Type;

export class IssueRpcError extends Schema.TaggedError<IssueRpcError>()("IssueRpcError", {
  message: Schema.String,
  detail: Schema.optional(Schema.String),
}) {}
