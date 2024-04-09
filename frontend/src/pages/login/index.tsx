import {AuthPage} from "../../components/pages/auth";
import {APP_TITLE} from "../../constants";

export const Login = () => {
    return (
        <AuthPage
            type="login"
            formProps={{
                initialValues: { username: "test", password: "test" },
            }}
            title={APP_TITLE}
        />
    );
};
