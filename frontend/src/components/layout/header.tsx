import React from "react";
import {
  useGetIdentity,
  useActiveAuthProvider,
  pickNotDeprecated,
} from "@refinedev/core";
import { HamburgerMenu } from "./hamburgerMenu";
import {
  ActionIcon,
  Avatar, Button,
  Flex,
  Header as MantineHeader,
  Sx,
  Title, Tooltip,
  useMantineTheme,
} from "@mantine/core";
import type { RefineThemedLayoutV2HeaderProps } from "@refinedev/mantine";
import {WhoAmI} from "../../types/auth";
import {IconBug} from "@tabler/icons-react";

export const ThemedHeaderV2: React.FC<RefineThemedLayoutV2HeaderProps> = ({
  isSticky,
  sticky,
}) => {
  const theme = useMantineTheme();

  const { data } = useGetIdentity();

  const user = data as WhoAmI;

  const borderColor =
    theme.colorScheme === "dark" ? theme.colors.dark[6] : theme.colors.gray[2];

  let stickyStyles: Sx = {};
  if (pickNotDeprecated(sticky, isSticky)) {
    stickyStyles = {
      position: "sticky",
      top: 0,
      zIndex: 1,
    };
  }

  return (
    <MantineHeader
      zIndex={199}
      height={64}
      py={6}
      px="sm"
      sx={{
        borderBottom: `1px solid ${borderColor}`,
        ...stickyStyles,
        backgroundColor:theme.colorScheme === "dark" ? "dark" : theme.colors.cyan[8],
      }}
    >
      <Flex
        align="center"
        justify="space-between"
        sx={{
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

          <Tooltip label={"Signaler un bug"} position="bottom" >
            <Button component="a" href="https://docs.google.com/spreadsheets/d/1R-dJhk6ziSuHTUE-D7Y-gNtFcdEZViyOdEEiRuIfoEo/edit?hl=fr#gid=0" target="_blank" color="black" size="xs">
              <IconBug style={{marginRight:"10px"}}/> Signaler un bug
            </Button>
          </Tooltip>
        </Flex>
      </Flex>
    </MantineHeader>
  );
};
