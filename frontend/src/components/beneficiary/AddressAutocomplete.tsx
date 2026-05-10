import React, {useEffect, useRef, useState} from "react";
import {Autocomplete, AutocompleteProps, Loader} from "@mantine/core";
import {useDebouncedValue} from "@mantine/hooks";
import {DEBOUNCE_TIME} from "../../constants";

const BAN_API = "https://api-adresse.data.gouv.fr/search/";

interface BanAddressFeature {
    properties: {
        label: string;
        name: string;
        postcode: string;
        city: string;
    };
}

interface BanApiResponse {
    features: BanAddressFeature[];
}

export interface AddressSelection {
    name: string;
    city: string;
    postcode: string;
}

interface AddressAutocompleteProps extends Omit<AutocompleteProps, "data" | "onOptionSubmit"> {
    onAddressSelect?: (addr: AddressSelection) => void;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
    value,
    onChange,
    onAddressSelect,
    ...rest
}) => {
    const [query, setQuery] = useState(value ?? "");
    const [debouncedQuery] = useDebouncedValue(query, DEBOUNCE_TIME);
    const [features, setFeatures] = useState<BanAddressFeature[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    // Mantine fires onChange after onOptionSubmit with the full label — this ref suppresses that call.
    const skipNextChangeRef = useRef(false);

    useEffect(() => {
        setQuery(value ?? "");
    }, [value]);

    useEffect(() => {
        if (debouncedQuery.trim().length < 3) {
            setFeatures([]);
            return;
        }

        const controller = new AbortController();
        setIsFetching(true);

        fetch(`${BAN_API}?q=${encodeURIComponent(debouncedQuery)}&limit=5`, {
            signal: controller.signal,
        })
            .then(r => r.json())
            .then((data: BanApiResponse) => {
                setFeatures(data.features);
                setIsFetching(false);
            })
            .catch(err => {
                if (err.name !== "AbortError") {
                    setFeatures([]);
                    setIsFetching(false);
                }
            });

        return () => controller.abort();
    }, [debouncedQuery]);

    const suggestions = features.map(f => f.properties.label);

    return (
        <Autocomplete
            {...rest}
            value={query}
            data={suggestions}
            onChange={(val) => {
                if (skipNextChangeRef.current) {
                    skipNextChangeRef.current = false;
                    return;
                }
                setQuery(val);
                onChange?.(val);
            }}
            onOptionSubmit={(label) => {
                const feature = features.find(f => f.properties.label === label);
                if (!feature) return;
                const streetValue = feature.properties.name;
                skipNextChangeRef.current = true;
                setQuery(streetValue);
                onChange?.(streetValue);
                onAddressSelect?.({
                    name: streetValue,
                    city: feature.properties.city,
                    postcode: feature.properties.postcode,
                });
            }}
            rightSection={isFetching ? <Loader size="xs" type="bars" /> : undefined}
            filter={({ options }) => options}
        />
    );
};

export default AddressAutocomplete;
