declare module "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions" {
  import { Map } from "mapbox-gl";

  export interface PaddingOptions {
    top?: number; // Отступ сверху, в пикселях
    bottom?: number; // Отступ снизу, в пикселях
    left?: number; // Отступ слева, в пикселях
    right?: number; // Отступ справа, в пикселях
  }

  export interface MapboxDirectionsOptions {
    styles?: any[]; // Переопределение свойств слоя Mapbox
    accessToken?: string; // Access Token для Mapbox API
    api?: string; // Пользовательский URL для эндпоинта API
    interactive?: boolean; // Включение/отключение интерактивности (по умолчанию true)
    profile?:
      | "mapbox/driving-traffic"
      | "mapbox/driving"
      | "mapbox/walking"
      | "mapbox/cycling"; // Режим маршрута
    alternatives?: boolean; // Включение альтернативных маршрутов
    congestion?: boolean; // Включение информации о пробках
    unit?: "imperial" | "metric"; // Единицы измерения
    compile?: Function; // Пользовательская функция для генерации инструкции
    geocoder?: Record<string, any>; // Объект с параметрами для геокодера
    controls?: {
      inputs?: boolean; // Включение/выключение полей ввода
      instructions?: boolean; // Показ/скрытие инструкций
      profileSwitcher?: boolean; // Показ/скрытие переключателя профилей
    };
    instructions?: {
      showWaypointInstructions?: boolean; // Показывать инструкции по путевым точкам
    };
    zoom?: number; // Зум карты
    language?: string; // Язык для текстовых инструкций
    placeholderOrigin?: string; // Текст-заполнитель для поля ввода места отправления
    placeholderDestination?: string; // Текст-заполнитель для поля ввода места назначения
    flyTo?: boolean; // Включение анимации карты при выборе маршрута
    exclude?: string; // Исключение определенных типов дорог
    routePadding?: number | PaddingOptions; // Отступы вокруг маршрута
  }

  class MapboxDirections {
    constructor(options?: MapboxDirectionsOptions);
    onAdd(map: mapboxgl.Map): HTMLElement;
    onRemove(map: mapboxgl.Map): void;
    interactive(state: boolean): MapboxDirections;
    getOrigin(): any; // Возвращает точку отправления
    setOrigin(query: [number, number] | string): MapboxDirections; // Устанавливает точку отправления
    getDestination(): any; // Возвращает точку назначения
    setDestination(query: [number, number] | string): MapboxDirections; // Устанавливает точку назначения
    reverse(): MapboxDirections; // Меняет местами отправление и назначение
    addWaypoint(
      index: number,
      waypoint: [number, number] | GeoJSON.Feature<GeoJSON.Point>,
    ): MapboxDirections; // Добавляет путевую точку
    setWaypoint(
      index: number,
      waypoint: [number, number] | GeoJSON.Feature<GeoJSON.Point>,
    ): MapboxDirections; // Меняет путевую точку
    removeWaypoint(index: number): MapboxDirections; // Удаляет путевую точку
    getWaypoints(): any[]; // Получает все путевые точки
    removeRoutes(): MapboxDirections; // Удаляет все маршруты
    on(type: string, fn: Function): MapboxDirections; // Подписывается на события
  }

  export default MapboxDirections;
}
