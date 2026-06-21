import "opentui-spinner/react" 
import { useTheme } from "../providers/theme"
import { MODE } from "@kodo/database/enums";
type SpinnerProps = {
    mode ?: MODE
}
export function Spinner({mode = MODE.BUILD}:SpinnerProps) {
    const { colors } = useTheme();
    const activeColor = mode === MODE.BUILD ? colors.primary : colors.planMode
    return (
        <spinner color={activeColor} name={"aesthetic"} />
    )
}