/**
 * KML Export Utility for Parcels
 */
import { ParcelResult } from '../../shared/parcel/types';

function escapeXml(s: any) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a KML string for a parcel result
 */
export function parcelToKml(result: ParcelResult, name: string): string {
  const { feature, metrics } = result;
  const geom = feature.geometry;

  // Extract polygon ring
  const coords = geom.type === 'Polygon'
    ? geom.coordinates[0]
    : geom.coordinates[0][0];

  // Generate coordinate string for KML (lon,lat,alt)
  const kmlCoords = coords.map(([lon, lat]: [number, number]) => `${lon},${lat},0`).join(' ');

  const props = feature.properties ?? {};
  const extendedData = Object.entries(props)
    .map(([k, v]) => `<Data name="${escapeXml(k)}"><value>${escapeXml(v)}</value></Data>`)
    .join('\n        ');

  const engineeringData = `
        <Data name="area_m2"><value>${metrics.area_m2.toFixed(2)}</value></Data>
        <Data name="perimeter_m"><value>${metrics.perimeter_m.toFixed(2)}</value></Data>
        <Data name="aspect_deg"><value>${metrics.aspect_deg?.toFixed(1) ?? 'N/A'}</value></Data>
        <Data name="slope_deg"><value>${metrics.slope_deg?.toFixed(1) ?? 'N/A'}</value></Data>
        <Data name="solar_exposure"><value>${escapeXml(metrics.solar_exposure)}</value></Data>
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <Style id="parcelStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>400000ff</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${escapeXml(name)}</name>
      <styleUrl>#parcelStyle</styleUrl>
      <ExtendedData>
        ${extendedData}
        ${engineeringData}
      </ExtendedData>
      <Polygon>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${kmlCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
}

/**
 * Trigger a browser download for the KML content
 */
export function downloadKml(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.kml') ? filename : `${filename}.kml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
