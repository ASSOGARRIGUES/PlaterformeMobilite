import React from "react";
import { useRouterContext, useRouterType, useLink } from "@refinedev/core";
import {Center, Text, useMantineColorScheme, useMantineTheme} from "@mantine/core";
import type { RefineLayoutThemedTitleProps } from "@refinedev/mantine";

const defaultText = "Refine Project";

const defaultIcon = (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    data-testid="refine-logo"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.7889 0.422291C12.6627 -0.140764 11.3373 -0.140764 10.2111 0.422291L2.21115 4.42229C0.85601 5.09986 0 6.48491 0 8V16C0 17.5151 0.85601 18.9001 2.21115 19.5777L10.2111 23.5777C11.3373 24.1408 12.6627 24.1408 13.7889 23.5777L21.7889 19.5777C23.144 18.9001 24 17.5151 24 16V8C24 6.48491 23.144 5.09986 21.7889 4.42229L13.7889 0.422291ZM8 8C8 5.79086 9.79086 4 12 4C14.2091 4 16 5.79086 16 8V16C16 18.2091 14.2091 20 12 20C9.79086 20 8 18.2091 8 16V8Z"
      fill="currentColor"
    />
    <path
      d="M14 8C14 9.10457 13.1046 10 12 10C10.8954 10 10 9.10457 10 8C10 6.89543 10.8954 6 12 6C13.1046 6 14 6.89543 14 8Z"
      fill="currentColor"
    />
  </svg>
);

export const ThemedTitleV2: React.FC<RefineLayoutThemedTitleProps> = ({
  collapsed,
  icon = defaultIcon,
  text = defaultText,
  wrapperStyles = {},
}) => {
  const theme = useMantineTheme();
  const routerType = useRouterType();
  const Link = useLink();
  const { Link: LegacyLink } = useRouterContext();

  const {colorScheme} = useMantineColorScheme()

  const ActiveLink = routerType === "legacy" ? LegacyLink : Link;

  return (
    <ActiveLink to="/" style={{ all: "unset" }}>
      <Center
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: "8px",
          ...wrapperStyles,
        }}
      >
        <Text
          lh={0}
          fz="inherit"
          c={colorScheme === "dark" ? "brand.5" : "brand.6"}
        >
          {icon}
        </Text>
        {!collapsed && (
          <Text
            fz="inherit"
            c={colorScheme === "dark" ? "white" : "black"}
          >
            {text}
          </Text>
        )}
      </Center>
    </ActiveLink>
  );
};
