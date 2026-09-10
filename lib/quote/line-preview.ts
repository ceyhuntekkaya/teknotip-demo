import { allowsMultipleChoices } from "@/lib/catalog/rules";
import type { GroupPreview, Product, Property, PropertyGroup } from "@/lib/catalog/types";
import type { ChatAction, QuoteLineSelection } from "./types";

export function groupPreviewFromSelections(
  group: PropertyGroup,
  selections: QuoteLineSelection[],
): GroupPreview {
  const selected: number[] = [];
  const choices: Record<number, number[]> = {};
  group.properties.forEach((property, index) => {
    const row = selections.find(
      (item) => item.groupId === group.id && item.propertyId === property.id,
    );
    if (!row) return;
    selected.push(index);
    if (!property.choice?.length) return;
    const indexes = row.choiceIds
      .map((id) => property.choice?.findIndex((choice) => choice.id === id) ?? -1)
      .filter((choiceIndex) => choiceIndex >= 0);
    if (indexes.length) choices[index] = indexes;
  });
  return { selected, choices };
}

export function modelIndexForLine(product: Product, modelId: string): number {
  const index = product.models.findIndex((model) => model.id === modelId);
  return index >= 0 ? index : 0;
}

export function choiceIdsAt(property: Property, choiceIndexes: number[]): string[] {
  return choiceIndexes
    .map((index) => property.choice?.[index]?.id)
    .filter((id): id is string => Boolean(id));
}

export function defaultChoiceIds(property: Property): string[] {
  const first = property.choice?.[0]?.id;
  return first ? [first] : [];
}

export function toggleChoiceIndexes(
  current: number[],
  choiceIndex: number,
  multiple: boolean,
): number[] {
  if (!multiple) return [choiceIndex];
  if (current.includes(choiceIndex)) {
    const next = current.filter((index) => index !== choiceIndex);
    return next.length ? next : current;
  }
  return [...current, choiceIndex];
}

export function addPropertyAction(lineId: string, property: Property): ChatAction {
  return {
    op: "set_choice",
    lineId,
    propertyId: property.id,
    choiceIds: defaultChoiceIds(property),
  };
}

export function removePropertyAction(lineId: string, property: Property): ChatAction {
  return {
    op: "remove_property",
    lineId,
    propertyId: property.id,
  };
}

export function setChoiceAction(
  lineId: string,
  group: PropertyGroup,
  property: Property,
  choiceIndexes: number[],
): ChatAction {
  const indexes = allowsMultipleChoices(group)
    ? choiceIndexes
    : choiceIndexes.slice(0, 1);
  return {
    op: "set_choice",
    lineId,
    propertyId: property.id,
    choiceIds: choiceIdsAt(property, indexes),
  };
}

export function setModelAction(lineId: string, modelId: string): ChatAction {
  return { op: "set_model", lineId, modelId };
}

export function setQuantityAction(lineId: string, quantity: number): ChatAction {
  return { op: "set_quantity", lineId, quantity };
}

export function setPriceAction(
  lineId: string,
  price: number,
  property?: Pick<Property, "id">,
): ChatAction {
  return property
    ? { op: "set_price", lineId, propertyId: property.id, price }
    : { op: "set_price", lineId, price };
}
