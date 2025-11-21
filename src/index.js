import { flite as core } from '../lite/index.js';
import { events, channels, services, json, error } from '../plugins.js';
export { status, response, text, html, json, error, run } from '../plugins.js';

export const flite = ({
    format = (r) => r instanceof Response ? r : json(r),
    missing = () => error(404),
    before,
    after,
    error: errorHooks,
    ...config
} = {}) =>
    services(channels(events(core({
        ...config,
        before,
        after: {
            ...after,
            all: [
                ...after?.all || [],
                (r) => r ?? missing(),
                ...(format !== false ? [format] : [])
            ]
        },
        error: errorHooks || {
            all: [(err) => error(err.status || 500, err.message)]
        }
    }))));
export default flite;