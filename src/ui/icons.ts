export function icon(name: string, size = 20): string {
    const paths: Record<string, string> = {
        essence: '<path d="M12 2 4 12a8 8 0 0 0 16 0L12 2Z"/><path d="M8 14a4 4 0 0 0 4 4"/>',
        coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-5a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9m3-10v12"/>',
        revive:'<path d="m12 2 8 8-8 12L4 10l8-8Z"/><path d="M12 7v8M8 11h8"/>',
        potion: '<path d="M9 2h6v4l4 6v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6l4-6V2Z"/><path d="M8 2h8M8 6h8M5 13h14"/><path d="M8 16h8v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2Z" fill="currentColor" stroke="none"/>',
        contract: '<path d="M6 3h10a3 3 0 0 1 3 3v2h-4M6 3a3 3 0 0 0-3 3v1h4v14h8V6a3 3 0 0 1 3-3"/><path d="M10 8h2M10 11h2M10 14h2"/><path d="m12 17 1.5 1.5L16 16"/>',
        bag: '<rect x="5" y="6" width="14" height="15" rx="3"/><path d="M9 6V4a3 3 0 0 1 6 0v2M5 12h14M9 15v3m6-3v3"/>',
        sword: '<path d="m5 3 4 2 10 10-4 4L5 9 3 5Z"/><path d="m13 19 6-6M17 17l4 4M3 3l4 4"/>',
        bow: '<path d="M4 4c12-4 20 4 16 16L4 4Z"/><path d="M4 20 19 5M13 5h6v6"/>',
        spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
        flame: '<path d="M13 2c2 7-5 6-3 11 2 0 4-2 4-5 5 5 7 8 4 12-4 4-12 2-13-3C4 11 9 8 13 2Z"/>',
        heart: '<path d="M20 5c-4-4-8 1-8 1S8 1 4 5s0 8 8 15c8-7 12-11 8-15Z"/>',
        shield: '<path d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5Z"/><path d="M12 6v11M8 11h8"/>',
        move: '<path d="M12 3v18M3 12h18m-5-5 5 5-5 5M7 7l-4 5 4 5m1-9 4-5 4 5m-8 8 4 5 4-5"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
        close: '<path d="m6 6 12 12M6 18 18 6"/>',
        auto: '<path d="m9 5 10 7-10 7Z"/>',
        pause: '<path d="M8 5v14M16 5v14"/>',
        scroll: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/>',
        help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 3v.1"/>',
        retreat: '<path d="M13 4h6v16h-6M15 12H3m4-4-4 4 4 4"/>',
        eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
        bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
        swap: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
        gear: '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
}
