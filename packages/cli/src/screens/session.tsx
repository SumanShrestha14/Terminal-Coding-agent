import { useParams } from "react-router";
import {useTheme} from "../providers/theme";

export function Session() {
    const { id } = useParams();
    return(
        <box flexGrow={1} padding={2}>
            <text>Session ID: {id}</text>
        </box>
    )
}