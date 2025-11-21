export const slugify = (value: string) => value.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
