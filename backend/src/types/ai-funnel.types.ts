export type AiObjectionCategory =
  | "price"
  | "no_time"
  | "partner"
  | "already_tried"
  | "unclear_real_chat";

export type AiReplyMode =
  | "mirror"
  | "open_lead"
  | "binary_choice"
  | "structured_choice"
  | "direct_funnel";

export type AiFunnelReply = {
  category: AiObjectionCategory;
  mode: AiReplyMode;
  replyText: string;
  returnToFunnel: boolean;
  targetStep:
    | "ask_name"
    | "intro_ack"
    | "situation_choice"
    | "tried_before_freetext"
    | "consequence_freetext"
    | "goal_choice"
    | "importance_scale"
    | "commitment"
    | "booking"
    | "info_only"
    | "done";
  mappedChoice: string | null;
  confidence: number;
};
