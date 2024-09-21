import React from "react";
import {
  useGetIdentity,
  useActiveAuthProvider,
  pickNotDeprecated,
} from "@refinedev/core";
import { HamburgerMenu } from "./hamburgerMenu";
import {
  ActionIcon,
  AppShell,
  Avatar, Button,
  Flex,
  Title, Tooltip, useMantineColorScheme, useMantineTheme,
} from "@mantine/core";
import type { RefineThemedLayoutV2HeaderProps } from "@refinedev/mantine";
import {WhoAmI} from "../../types/auth";
import {IconBug} from "@tabler/icons-react";
import OpenBugReportButton from "../bugreporter/OpenBugReportButton";
import ActionSelector from "../actions/ActionSelector";

const Header: React.FC<RefineThemedLayoutV2HeaderProps> = ({
  isSticky,
  sticky,
}) => {

  const theme = useMantineTheme()

  const {colorScheme} = useMantineColorScheme()

  const { data } = useGetIdentity();

  const user = data as WhoAmI;

  const borderColor =
    colorScheme === "dark" ? theme.colors.dark[6] : theme.colors.gray[2];

  let stickyStyles = {};
  if (pickNotDeprecated(sticky, isSticky)) {
    stickyStyles = {
      position: "sticky",
      top: 0,
      zIndex: 1,
    };
  }

  return (
    <AppShell.Header
      // zIndex={199}
      // py={6}
      // px="sm"
      style={{
        borderBottom: `1px solid ${borderColor}`,
        // ...stickyStyles,
        backgroundColor:colorScheme === "dark" ? "dark" : theme.colors.cyan[8],
      }}
    >
      <Flex
        align="center"
        justify="space-between"
        style={{
          height: "100%",
        }}
      >
        <HamburgerMenu />
        <Flex align="center" gap="sm">
          {user?.first_name && (
            <Title order={6} data-testid="header-user-name">
              Bonjour, {user?.first_name}
            </Title>
          )}
          {user?.avatar && (
            <Avatar src={user?.avatar} alt={user?.name} radius="xl" />
          )}

          <ActionSelector/>

          <OpenBugReportButton/>

        </Flex>
      </Flex>
    </AppShell.Header>
  );
};

export default Header;