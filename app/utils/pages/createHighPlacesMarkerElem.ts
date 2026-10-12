import createPlacesMarkerElem from "./createPlacesMarkerElem";

export default (title: string) => {
  const element = createPlacesMarkerElem(title);
  element.classList.add("pg-place-marker--landmark");
  return element;
};
