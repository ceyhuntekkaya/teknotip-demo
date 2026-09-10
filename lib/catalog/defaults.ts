import { makeNodeId } from "./ids";
import type { Choice, Product, ProductModel, Property, PropertyGroup } from "./types";

export function emptyProduct(used = new Set<string>()): Product {
  return {
    id: makeNodeId("p", "Yeni ürün", null, used),
    name: "Yeni ürün",
    models: [],
    propertyGroups: [],
  };
}

export function emptyModel(used = new Set<string>(), parentId = "p_yeni-urun"): ProductModel {
  return {
    id: makeNodeId("m", "Yeni model", parentId, used),
    name: "Yeni model",
    price: 0,
    description: "",
    image: "",
    category: "",
  };
}

export function emptyGroup(used = new Set<string>(), parentId = "p_yeni-urun"): PropertyGroup {
  return {
    id: makeNodeId("g", "Yeni grup", parentId, used),
    name: "Yeni grup",
    state: "required",
    type: "single_choice",
    properties: [],
  };
}

export function emptyProperty(used = new Set<string>(), parentId = "g_yeni-grup"): Property {
  return {
    id: makeNodeId("pr", "Yeni özellik", parentId, used),
    name: "Yeni özellik",
  };
}

export function emptyChoice(used = new Set<string>(), parentId = "pr_yeni-ozellik"): Choice {
  return {
    id: makeNodeId("c", "Yeni seçenek", parentId, used),
    name: "Yeni seçenek",
  };
}
