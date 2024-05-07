import React from "react";
import {
  LoginPageProps,
  LoginFormTypes,
  useRouterType,
  useLink,
  useActiveAuthProvider,
  useLogin,
  useTranslate,
  useRouterContext,
} from "@refinedev/core";
import { ThemedTitleV2, FormContext } from "@refinedev/mantine";
import { FormPropsType } from "../index";

import {
  Box,
  Card,
  Checkbox,
  PasswordInput,
  Space,
  TextInput,
  Title,
  Anchor,
  Button,
  Text,
  Divider,
  Stack,
  BoxProps,
  CardProps,
  useMantineTheme,
} from "@mantine/core";

import {cardStyles, layoutStyles, pageTitleStyles, titleStyles} from "./styles";

type LoginProps = LoginPageProps<BoxProps, CardProps, FormPropsType>;

/**
 * **refine** has a default login page form which is served on `/login` route when the `authProvider` configuration is provided.
 * @see {@link https://refine.dev/docs/api-reference/mantine/components/mantine-auth-page/#login} for more details.
 */
export const LoginPage: React.FC<LoginProps> = ({
  providers,
  registerLink,
  forgotPasswordLink,
  rememberMe,
  contentProps,
  wrapperProps,
  renderContent,
  formProps,
  title,
  hideForm,
}) => {
  const theme = useMantineTheme();
  const { useForm, FormProvider } = FormContext;
  const { onSubmit: onSubmitProp, ...useFormProps } = formProps || {};
  const translate = useTranslate();
  const routerType = useRouterType();
  const Link = useLink();
  const { Link: LegacyLink } = useRouterContext();

  const ActiveLink = routerType === "legacy" ? LegacyLink : Link;

  const form = useForm({
    initialValues: {
      email: "",
      password: "",
      remember: false,
    },
    validate: {
      email: (value: any) => value === "",
      password: (value: any) => value === "",
    },
    ...useFormProps,
  });
  const { onSubmit, getInputProps } = form;

  const authProvider = useActiveAuthProvider();
  const { mutate: login, isLoading } = useLogin<LoginFormTypes>({
    v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
  });

  const PageTitle =
    title === false ? null : (
      <div style={pageTitleStyles}>
        {title ?? <ThemedTitleV2 collapsed={false} />}
      </div>
    );

  const renderProviders = () => {
    if (providers && providers.length > 0) {
      return (
        <>
          <Stack spacing={8}>
            {providers.map((provider) => {
              return (
                <Button
                  key={provider.name}
                  variant="default"
                  fullWidth
                  leftIcon={provider.icon}
                  onClick={() =>
                    login({
                      providerName: provider.name,
                    })
                  }
                >
                  {provider.label}
                </Button>
              );
            })}
          </Stack>
          {!hideForm && (
            <Divider
              my="md"
              labelPosition="center"
              label={translate("pages.login.divider", "or")}
            />
          )}
        </>
      );
    }
    return null;
  };

  const [loginError, setLoginError] = React.useState<string | null>(null);

  const CardContent = (
    <Card style={cardStyles} {...(contentProps ?? {})}>
      <Title
        style={titleStyles}
        color={theme.colorScheme === "dark" ? "brand.5" : "brand.8"}
      >
        {"Connexion à votre compte"}
      </Title>
      <Space h="sm" />
      <Space h="lg" />
      {renderProviders()}
      {!hideForm && (
        <FormProvider form={form}>
          <form
            onSubmit={onSubmit((values: any) => {
              if (onSubmitProp) {
                return onSubmitProp(values);
              }

              login(values, {
                onSuccess: (data) => {
                  // @ts-ignore
                  if(!data.success){
                    // @ts-ignore
                    setLoginError(data.error.message);
                  }
                }
              });
            })}
          >
            <Text color="red" mt="md">
              {loginError}
            </Text>

            <TextInput
              name="email"
              label={"Adresse email"}
              placeholder={"Adresse email"}
              autoComplete={"email"}
              {...getInputProps("email")}
            />
            <PasswordInput
              name="password"
              autoComplete="current-password"
              mt="md"
              label={"Mot de passe"}
              placeholder="●●●●●●●●"
              {...getInputProps("password")}
            />
            <Box
              mt="md"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
            </Box>
            <Button
              mt="md"
              fullWidth
              size="md"
              type="submit"
              loading={isLoading}
            >
              {translate("pages.login.signin", "Connexion")}
            </Button>
          </form>
        </FormProvider>
      )}
    </Card>
  );

  return (
    <Box
      style={{
        ...layoutStyles,
        justifyContent: hideForm ? "flex-start" : layoutStyles.justifyContent,
        paddingTop: hideForm ? "15dvh" : layoutStyles.padding,
      }}
      {...(wrapperProps ?? {})}
    >
      {renderContent ? (
        renderContent(CardContent, PageTitle)
      ) : (
        <>
          {PageTitle}
          {CardContent}
        </>
      )}
    </Box>
  );
};
