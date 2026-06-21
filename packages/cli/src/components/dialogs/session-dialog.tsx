import type { InferResponseType } from "hono/client";
import { apiClient } from "../../lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { useDialog } from "../../providers/dialog";
import { useNavigate } from "react-router";
import { useToast } from "../../providers/toast";
import { getErrorMessage } from "../../lib/http-errors";
import { TextAttributes } from "@opentui/core";
import { DialogSearchList } from "../dialog-search-list";
import { format } from "date-fns";
import { Spinner } from "../spinner";

type Session = InferResponseType<
  (typeof apiClient.sessions)["$get"],
  200
>[number];

export const SessionDialog = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const { close } = useDialog();
  const navigate = useNavigate();
  // const { show } = useToast();
  useEffect(() => {
    let ignore = false;

    const fetchSessions = async () => {
      setLoading(true)
      try {
        const res = await apiClient.sessions.$get();
        if (!res.ok) throw new Error(await getErrorMessage(res));
        const data = await res.json();

        if (!ignore) {
          setSessions(data);
          setLoading(false);
        }
      } catch (e) {
        if (!ignore) {
          // show({
          //   variant: "error",
          //   message:
          //     e instanceof Error ? e.message : "Failed to fetch sessions",
          // });
          close();
        }
      }
    };
    fetchSessions();
    return () => {
      ignore = true;
    };
  }, [close]);

  const handleSelect = useCallback(
    (session: Session) => {
      close();
      navigate(`/sessions/${session.id}`);
    },
    [close, navigate],
  );

  if (loading) {
    return (
      <box flexDirection="column">
        <text attributes={TextAttributes.DIM}>Loading sessions..</text>
        <Spinner/>
      </box>
    );
  }

  return (
    <DialogSearchList
      items={sessions}
      onHighlight={() => null}
      onSelect={handleSelect}
      filterfn={(session, query) =>
        session.title.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(session, isSelected) => (
        <box flexDirection="row" width="100%">
          <text selectable={false} fg={isSelected ? "black" : "white"}>
            {session.title}
          </text>
          <box flexGrow={1} />
          <text
            selectable={false}
            fg={isSelected ? "black" : "white"}
            attributes={TextAttributes.DIM}
          >
            {format(new Date(session.createdAt), "hh:mm:ss aa")}
          </text>
        </box>
      )}
      getKey={(session) => session.id}
      placeholder="Search sessions..."
      emptyString="No sessions found"
    />
  );
};

