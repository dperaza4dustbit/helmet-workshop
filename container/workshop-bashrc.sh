# Sourced once per interactive shell in the workshop pod.
if [[ -z "${WORKSHOP_LOGIN_BANNER_SHOWN:-}" ]]; then
  export WORKSHOP_LOGIN_BANNER_SHOWN=1
  echo ""
  echo "Helmet Corp Rewards Workshop"
  echo "  Checklist: coordinator page → expand \"Lab activities\" when instructed."
  echo ""

fi
