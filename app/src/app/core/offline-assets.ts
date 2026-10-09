import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  cloudOfflineOutline,
  constructOutline,
  eyeOffOutline,
  eyeOutline,
  homeOutline,
  logInOutline,
  logOutOutline,
  personCircleOutline,
  wifi,
} from 'ionicons/icons';

/**
 * Recursos que deben estar disponibles sin internet.
 *
 * Ionic descarga cada icono y cada componente la primera vez que se usa. Si eso pasa
 * sin conexión, no aparecen. Por eso:
 * - los iconos se incluyen dentro de la app con addIcons (agrega aquí los nuevos);
 * - los componentes que se usan después se precargan al arrancar.
 */
export function registrarIconos() {
  addIcons({
    alertCircleOutline,
    cloudOfflineOutline,
    constructOutline,
    eyeOffOutline,
    eyeOutline,
    homeOutline,
    logInOutline,
    logOutOutline,
    personCircleOutline,
    wifi,
  });
}

/** Componentes de Ionic que la app usa más tarde (avisos, alertas, etc.). */
const COMPONENTES = [
  'ion-toast',
  'ion-alert',
  'ion-backdrop',
  'ion-badge',
  'ion-spinner',
  'ion-footer',
  'ion-refresher',
  'ion-refresher-content',
];

/** Inserta cada componente oculto una vez para que Ionic descargue su código mientras hay red. */
export async function precargarComponentes() {
  // Dentro de un ion-content oculto: ion-refresher exige estar en uno (si no, Ionic marca error).
  const caja = document.createElement('ion-content');
  caja.hidden = true;
  COMPONENTES.forEach(tag => {
    const el = document.createElement(tag);
    if (tag === 'ion-refresher') el.setAttribute('slot', 'fixed');
    caja.appendChild(el);
  });
  document.body.appendChild(caja);

  await Promise.all(COMPONENTES.map(tag => customElements.whenDefined(tag)));
  caja.remove();
}
