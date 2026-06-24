const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_TIMEOUT_MS = 8_000;
const DEFAULT_MONDAY_API_VERSION = "2026-04";

export type MondayErrorCode =
  | "missing_credentials"
  | "monday_http"
  | "monday_graphql"
  | "monday_timeout";

export type MondayResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: MondayErrorCode; message: string; status?: number } };

type MondayGraphqlResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

export type MondayColumnValue = {
  id: string;
  text: string | null;
  value?: string | null;
};

export type MondayItem = {
  id: string;
  name: string;
  group?: { id: string; title: string } | null;
  board?: { id: string; name: string } | null;
  column_values?: MondayColumnValue[];
};

export type MondayBoardItemsResponse = {
  boards: {
    id: string;
    name: string;
    items_page?: {
      items: MondayItem[];
    } | null;
  }[];
};

export type MondayTask = {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  projectName: string;
  status: string;
  owner: string;
  priority: string;
  dueDate: string | null;
  source: "monday";
  url: string;
};

export type MondayBoard = {
  id: string;
  name: string;
  url?: string;
};

export type MondayGroup = {
  id: string;
  title: string;
};

export type MondayColumn = {
  id: string;
  title: string;
  type: string;
};

function getToken(): string | null {
  return process.env.MONDAY_MYBOTIA_API_TOKEN?.trim() || null;
}

export function mondayIsConfigured(): boolean {
  return Boolean(getToken());
}

function mondayApiVersion(): string {
  return process.env.MONDAY_API_VERSION?.trim() || DEFAULT_MONDAY_API_VERSION;
}

export async function mondayGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<MondayResult<T>> {
  const token = getToken();
  if (!token) {
    return {
      ok: false,
      error: {
        code: "missing_credentials",
        message: "MONDAY_MYBOTIA_API_TOKEN absent de l'environnement serveur.",
      },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MONDAY_TIMEOUT_MS);

  try {
    const response = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        Authorization: token,
        "API-Version": mondayApiVersion(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as MondayGraphqlResponse<T>;
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: "monday_http",
          message: `Monday API HTTP ${response.status}`,
          status: response.status,
        },
      };
    }

    if (payload.errors?.length) {
      return {
        ok: false,
        error: {
          code: "monday_graphql",
          message: payload.errors.map((error) => error.message || "GraphQL error").join("; "),
        },
      };
    }

    return { ok: true, data: payload.data as T };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? { code: "monday_timeout", message: "Monday API timeout." }
        : {
            code: "monday_http",
            message: error instanceof Error ? error.message : String(error),
            status: 0,
          },
    };
  } finally {
    clearTimeout(timer);
  }
}

function findColumn(item: MondayItem, candidates: string[]): string | null {
  const columns = item.column_values || [];
  const lowered = candidates.map((candidate) => candidate.toLowerCase());
  const column = columns.find((value) => lowered.some((candidate) => value.id.toLowerCase().includes(candidate)));
  return column?.text?.trim() || null;
}

export function normalizeMondayItems(payload: MondayBoardItemsResponse): MondayTask[] {
  const tasks: MondayTask[] = [];

  for (const board of payload.boards || []) {
    for (const item of board.items_page?.items || []) {
      const projectName =
        findColumn(item, ["projet", "project"]) ||
        item.group?.title ||
        board.name;
      const status = findColumn(item, ["statut", "status"]) || "A faire";
      const owner = findColumn(item, ["responsable", "owner", "person", "people"]) || "Non assigne";
      const priority = findColumn(item, ["priorite", "priority"]) || "Normale";
      const dueDate = findColumn(item, ["date", "due", "echeance", "deadline"]);

      tasks.push({
        id: item.id,
        title: item.name,
        boardId: board.id,
        boardName: board.name,
        projectName,
        status,
        owner,
        priority,
        dueDate,
        source: "monday",
        url: `https://mybotia.monday.com/boards/${board.id}/pulses/${item.id}`,
      });
    }
  }

  return tasks;
}

export async function createMondayPilotBoard(
  name = "MyBotIA - Production & Taches",
): Promise<MondayResult<MondayBoard>> {
  const result = await mondayGraphql<{ create_board: MondayBoard }>(
    `
      mutation CreateMondayPilotBoard($boardName: String!) {
        create_board(board_name: $boardName, board_kind: private) {
          id
          name
          url
        }
      }
    `,
    { boardName: name },
  );
  return result.ok ? { ok: true, data: result.data.create_board } : result;
}

export async function createMondayGroup(
  boardId: string,
  title: string,
): Promise<MondayResult<MondayGroup>> {
  const result = await mondayGraphql<{ create_group: MondayGroup }>(
    `
      mutation CreateMondayGroup($boardId: ID!, $groupName: String!) {
        create_group(board_id: $boardId, group_name: $groupName) {
          id
          title
        }
      }
    `,
    { boardId, groupName: title },
  );
  return result.ok ? { ok: true, data: result.data.create_group } : result;
}

export async function createMondayColumn(
  boardId: string,
  title: string,
  columnType: "text" | "status" | "date" | "dropdown" | "long_text",
): Promise<MondayResult<MondayColumn>> {
  const result = await mondayGraphql<{ create_column: MondayColumn }>(
    `
      mutation CreateMondayColumn($boardId: ID!, $title: String!, $columnType: ColumnType!) {
        create_column(board_id: $boardId, title: $title, column_type: $columnType) {
          id
          title
          type
        }
      }
    `,
    { boardId, title, columnType },
  );
  return result.ok ? { ok: true, data: result.data.create_column } : result;
}

export async function createMondayItem(
  boardId: string,
  groupId: string,
  itemName: string,
  columnValues: Record<string, unknown>,
): Promise<MondayResult<{ id: string; name: string; url?: string }>> {
  const result = await mondayGraphql<{ create_item: { id: string; name: string; url?: string } }>(
    `
      mutation CreateMondayItem($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) {
          id
          name
          url
        }
      }
    `,
    { boardId, groupId, itemName, columnValues: JSON.stringify(columnValues) },
  );
  return result.ok ? { ok: true, data: result.data.create_item } : result;
}

export async function updateMondayItemColumns(
  boardId: string,
  itemId: string,
  columnValues: Record<string, unknown>,
): Promise<MondayResult<{ id: string; name: string }>> {
  const result = await mondayGraphql<{ change_multiple_column_values: { id: string; name: string } }>(
    `
      mutation UpdateMondayItemColumns($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
          id
          name
        }
      }
    `,
    { boardId, itemId, columnValues: JSON.stringify(columnValues) },
  );
  return result.ok ? { ok: true, data: result.data.change_multiple_column_values } : result;
}
