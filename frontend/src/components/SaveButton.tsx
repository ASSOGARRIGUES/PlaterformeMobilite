import React, {PropsWithChildren} from "react";
import {
  RefineButtonClassNames,
  RefineButtonTestIds,
} from "@refinedev/ui-types";
import {ActionIcon, ActionIconProps, Button, ButtonProps} from "@mantine/core";
import {IconDeviceFloppy, IconProps} from "@tabler/icons-react";


export type RefineSaveButtonProps<
    TComponentProps extends {} = Record<string, unknown>,
    TExtraProps extends {} = {},
> = PropsWithChildren<{hideText?: boolean;}> &
    { onClick?: React.PointerEventHandler<HTMLButtonElement>; } &
    TComponentProps &
    TExtraProps & {};

export type SaveButtonProps = RefineSaveButtonProps<
    ButtonProps,
    {
      svgIconProps?: Omit<IconProps, "ref">;
    }
>;

const mapButtonVariantToActionIconVariant = (
    variant?: ButtonProps["variant"],
): ActionIconProps['variant'] | undefined => {
  switch (variant) {
    case "white":
      return "default";
    default:
      return variant;
  }
};

/**
 * `<SaveButton>` uses Mantine {@link https://mantine.dev/core/button `<Button> `}.
 * It uses it for presantation purposes only. Some of the hooks that refine has adds features to this button.
 *
 * @see {@link https://refine.dev/docs/api-reference/mantine/components/buttons/save-button} for more details.
 */
export const SaveButton: React.FC<SaveButtonProps> = ({
                                                        hideText = false,
                                                        svgIconProps,
                                                        children,
                                                        ...rest
                                                      }) => {
  const label = "Enregistrer"

  const { variant, styles, size, ...commonProps } = rest;

  return hideText ? (
      <ActionIcon
          {...(variant
              ? {
                variant: mapButtonVariantToActionIconVariant(variant),
              }
              : { variant: "filled", color: "primary" })}
          aria-label={label}
          data-testid={RefineButtonTestIds.SaveButton}
          className={RefineButtonClassNames.SaveButton}
          //{...commonProps}
      >
        <IconDeviceFloppy size={18} {...svgIconProps} />
      </ActionIcon>
  ) : (
      <Button
          variant="filled"
          leftSection={<IconDeviceFloppy size={18} {...svgIconProps} />}
          data-testid={RefineButtonTestIds.SaveButton}
          className={RefineButtonClassNames.SaveButton}
          {...rest}
      >
        {children ?? label}
      </Button>
  );
};
