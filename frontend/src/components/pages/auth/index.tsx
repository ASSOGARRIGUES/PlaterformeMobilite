import React from "react";
import { AuthPageProps } from "@refinedev/core";
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  UpdatePasswordPage,
} from "./components";
import { BoxProps, CardProps } from "@mantine/core";
import { UseFormInput } from "@mantine/form/lib/types";

export type FormPropsType = UseFormInput<unknown> & {
  onSubmit?: (values: any) => void;
};

export type AuthProps = AuthPageProps<BoxProps, CardProps, FormPropsType>;

/**
 * **refine** has a default auth page form served on the `/login` route when the `authProvider` configuration is provided.
 * @param title is not implemented yet.
 * @see {@link https://refine.dev/docs/api-reference/mantine/components/mantine-auth-page/} for more details.
 */
export const AuthPage: React.FC<AuthProps> = (props) => {
  const { type } = props;

  const renderView = () => {
    switch (type) {
      case "register":
        return <RegisterPage {...props} />;
      case "forgotPassword":
        return <ForgotPasswordPage {...props} />;
      case "updatePassword":
        return <UpdatePasswordPage {...props} />;
      default:
        return <LoginPage {...props} />;
    }
  };

  return <>{renderView()}</>;
};
