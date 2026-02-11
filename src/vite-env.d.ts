/// <reference types="vite/client" />

import 'react';

declare module 'react' {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        webkitdirectory?: string | boolean;
        directory?: string | boolean;
    }
}

declare module '*.css' {
    const content: { [className: string]: string };
    export default content;
}
