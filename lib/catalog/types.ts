export const GROUP_STATES = [
  "required",
  "optional",
  "required_one",
  "required_multiple",
] as const;

export type GroupState = (typeof GROUP_STATES)[number];

export const PROPERTY_STATES = ["required", "optional"] as const;

export type PropertyState = (typeof PROPERTY_STATES)[number];

export const GROUP_TYPES = ["single_choice", "multiple_choice"] as const;

export type GroupType = (typeof GROUP_TYPES)[number];

export interface Choice {
  id: string;
  name: string;
  price?: number;
}

export interface Property {
  id: string;
  name: string;
  price?: number;
  state?: PropertyState;
  choice?: Choice[];
}

export interface PropertyGroup {
  id: string;
  name: string;
  state: GroupState;
  type: GroupType;
  properties: Property[];
}

export interface ProductModel {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
}

export interface Product {
  id: string;
  name: string;
  models: ProductModel[];
  propertyGroups: PropertyGroup[];
}

export type Catalog = Product[];

export type CatalogPath =
  | { kind: "product"; p: number }
  | { kind: "model"; p: number; m: number }
  | { kind: "group"; p: number; g: number }
  | { kind: "property"; p: number; g: number; pr: number }
  | { kind: "choice"; p: number; g: number; pr: number; c: number };

export type GroupPreview = {
  selected: number[];
  choices: Record<number, number[]>;
};

export type PreviewState = {
  productIndex: number;
  modelIndex: number;
  groups: GroupPreview[];
};

export const GROUP_STATE_LABELS: Record<GroupState, string> = {
  required: "Zorunlu",
  optional: "Opsiyonel",
  required_one: "Tek seçim",
  required_multiple: "Çoklu seçim",
};

export const PROPERTY_STATE_LABELS: Record<PropertyState, string> = {
  required: "Zorunlu",
  optional: "Opsiyonel",
};

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  single_choice: "Tekli seçenek",
  multiple_choice: "Çoklu seçenek",
};
