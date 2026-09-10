import type { Catalog } from "@/lib/catalog/types";
import { linePriceParts, propertyAddOn, summarizeDraft } from "./price";
import type {
  QuoteDocument,
  QuoteDocumentGroup,
  QuoteDocumentProduct,
  QuoteDraft,
} from "./types";

export function hydrateQuote(
  catalog: Catalog,
  draft: QuoteDraft,
  date = new Date(),
): QuoteDocument {
  const products: QuoteDocumentProduct[] = [];

  for (const line of draft.items) {
    const product = catalog.find((item) => item.id === line.productId);
    if (!product) continue;
    const model =
      product.models.find((item) => item.id === line.modelId) ?? product.models[0];
    if (!model) continue;

    const groups: QuoteDocumentGroup[] = [];
    for (const group of product.propertyGroups) {
      const selected = line.selections.filter((item) => item.groupId === group.id);
      if (!selected.length) continue;

      const properties = selected.flatMap((selection) => {
        const property = group.properties.find((item) => item.id === selection.propertyId);
        if (!property) return [];
        if (property.choice?.length) {
          const override = selection.priceOverride;
          return selection.choiceIds.flatMap((choiceId, index) => {
            const choice = property.choice?.find((item) => item.id === choiceId);
            if (!choice) return [];
            const catalogPrice = choice.price ?? 0;
            const price =
              typeof override === "number"
                ? index === 0
                  ? override
                  : 0
                : catalogPrice;
            return [
              {
                id: property.id,
                type: group.type,
                name: property.name,
                value: choice.name,
                price,
                choiceId: choice.id,
              },
            ];
          });
        }
        return [
          {
            id: property.id,
            type: group.type,
            name: property.name,
            value: "Seçildi",
            price:
              selection.priceOverride ?? propertyAddOn(property, []),
          },
        ];
      });

      if (!properties.length) continue;
      groups.push({
        id: group.id,
        name: group.name,
        state: group.state,
        type: group.type,
        price: properties.reduce((sum, item) => sum + item.price, 0),
        properties,
      });
    }

    const parts = linePriceParts(product, line);
    products.push({
      lineId: line.lineId,
      id: product.id,
      name: product.name,
      modelId: model.id,
      modelName: model.name,
      price: parts.unit,
      quantity: line.quantity,
      description: model.description,
      image: model.image,
      category: model.category,
      propertyGroups: groups,
      lineTotal: parts.lineTotal,
    });
  }

  const isoDate = date.toISOString().slice(0, 10);
  const quoted = draft.quotedTo;
  const greeting = [quoted?.title, quoted?.contactPerson].filter(Boolean).join(" ");
  return {
    quotedTo: {
      id: "",
      name: "",
      institution: quoted?.institution ?? "",
      contactPerson: greeting,
      title: quoted?.title,
      date: isoDate,
      quoteNumber: draft.quoteNumber,
    },
    products,
    priceSummary: summarizeDraft(catalog, draft),
    preparedBy: "",
  };
}
