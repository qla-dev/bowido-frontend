import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

/** Shared compact SweetAlert instance for every application notification. */
export const appAlert = Swal.mixin({
  width: '25rem',
  padding: '1.5rem',
  confirmButtonColor: '#00A655',
  buttonsStyling: false,
  customClass: {
    popup: 'trackpal-alert-popup',
    title: 'trackpal-alert-title',
    htmlContainer: 'trackpal-alert-message',
    confirmButton: 'trackpal-alert-confirm',
  },
});
